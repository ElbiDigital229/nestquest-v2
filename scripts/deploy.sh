#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# NestQuest — Zero-Downtime Deploy Script (EC2 / Ubuntu)
#
# Usage:
#   ./scripts/deploy.sh           ← pull latest + restart
#   ./scripts/deploy.sh rollback  ← revert to previous release
#
# Deployment strategy:
#   - PM2 is used as the process manager (keeps the app alive across restarts)
#   - We pull latest code, install deps, build frontend, then do a hot reload
#   - PM2 reload (not restart) achieves near-zero downtime: new workers start
#     before old ones are killed
#   - If the health check fails post-reload, we immediately rollback
#
# Requirements (one-time setup):
#   sudo npm install -g pm2
#   pm2 startup    ← follow the printed command
#   pm2 save
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="/home/ubuntu/nestquest"
LOG_FILE="/var/log/nestquest-deploy.log"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
ROLLBACK_MARKER="${APP_DIR}/.last_deploy_commit"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }

# ── Rollback ───────────────────────────────────────────

if [[ "${1:-}" == "rollback" ]]; then
  if [[ ! -f "${ROLLBACK_MARKER}" ]]; then
    log "ERROR: No rollback marker found — cannot rollback"
    exit 1
  fi
  PREV_COMMIT=$(cat "${ROLLBACK_MARKER}")
  log "Rolling back to ${PREV_COMMIT}..."
  cd "${APP_DIR}"
  git checkout "${PREV_COMMIT}"
  npm ci --omit=dev
  npm run build
  pm2 reload nestquest --update-env
  log "Rollback complete"
  exit 0
fi

# ── Deploy ─────────────────────────────────────────────

cd "${APP_DIR}"

log "Starting deploy ($(git rev-parse --short HEAD))"

# Save current commit for rollback
git rev-parse HEAD > "${ROLLBACK_MARKER}"

# Pull latest
log "Pulling latest code..."
git fetch origin main
git reset --hard origin/main

NEW_COMMIT=$(git rev-parse --short HEAD)
log "Deploying commit ${NEW_COMMIT}"

# Install dependencies (production only)
log "Installing dependencies..."
npm ci --omit=dev

# Build frontend assets
log "Building frontend..."
npm run build

# Run any pending DB migrations (Drizzle)
log "Running DB migrations..."
npx drizzle-kit push || {
  log "ERROR: Migration failed — aborting deploy"
  exit 1
}

# Reload (not restart) — zero-downtime hot swap
log "Reloading application..."
pm2 reload nestquest --update-env

# ── Health check ───────────────────────────────────────

log "Waiting for health check..."
sleep 8

MAX_ATTEMPTS=6
for i in $(seq 1 $MAX_ATTEMPTS); do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || echo "000")
  if [[ "${HTTP_STATUS}" == "200" ]]; then
    log "Health check passed (attempt ${i}) — deploy successful"
    pm2 save
    log "Deploy complete: ${NEW_COMMIT}"
    exit 0
  fi
  log "Attempt ${i}/${MAX_ATTEMPTS}: status ${HTTP_STATUS} — retrying in 10s"
  sleep 10
done

# ── Auto-rollback on health check failure ──────────────

log "ERROR: Health check failed — initiating automatic rollback"
PREV_COMMIT=$(cat "${ROLLBACK_MARKER}")
git checkout "${PREV_COMMIT}"
npm ci --omit=dev
npm run build
pm2 reload nestquest --update-env
sleep 8
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || echo "000")

if [[ "${HTTP_STATUS}" == "200" ]]; then
  log "Rollback successful — application restored to ${PREV_COMMIT}"
else
  log "CRITICAL: Rollback failed — manual intervention required"
fi

exit 1
