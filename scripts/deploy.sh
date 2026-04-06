#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# NestQuest -- Zero-Downtime Deploy Script (EC2 / Ubuntu)
#
# Usage:
#   ./scripts/deploy.sh           <- pull latest + restart
#   ./scripts/deploy.sh rollback  <- revert to previous release
#
# Requirements (one-time setup):
#   sudo npm install -g pm2 tsx
#   sudo mkdir -p /var/log/nestquest && sudo chown ubuntu:ubuntu /var/log/nestquest
#   pm2 startup    <- follow the printed command
#   pm2 save
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="/home/ubuntu/nestquest-v2"
LOG_FILE="/var/log/nestquest/deploy.log"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
ROLLBACK_MARKER="${APP_DIR}/.last_deploy_commit"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }

# ── Rollback ──────────────────────────────────────────────────────────────────

if [[ "${1:-}" == "rollback" ]]; then
  if [[ ! -f "${ROLLBACK_MARKER}" ]]; then
    log "ERROR: No rollback marker found -- cannot rollback"
    exit 1
  fi
  PREV_COMMIT=$(cat "${ROLLBACK_MARKER}")
  log "Rolling back to ${PREV_COMMIT}..."
  cd "${APP_DIR}"
  git checkout "${PREV_COMMIT}"
  npm ci --omit=dev
  npm run build
  pm2 reload ecosystem.config.cjs --env production --update-env
  log "Rollback complete"
  exit 0
fi

# ── Deploy ────────────────────────────────────────────────────────────────────

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

# Install dependencies (production only -- dotenv must be in dependencies, not devDependencies)
log "Installing dependencies..."
npm ci --omit=dev

# Build frontend assets
log "Building frontend..."
npm run build

# Run any pending DB migrations
log "Running DB migrations..."
npx drizzle-kit push || {
  log "ERROR: Migration failed -- aborting deploy"
  exit 1
}

# ── First-deploy seed check ───────────────────────────────────────────────────
# If the users table is empty this is a fresh DB -- load seed data.
# DATABASE_URL must be set in .env (loaded by the app via dotenv/config).
# We load it here manually just for this psql call.
if [[ -f "${APP_DIR}/.env" ]]; then
  set -a; source "${APP_DIR}/.env"; set +a
fi

USER_COUNT=$(psql "${DATABASE_URL}" -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
if [[ "${USER_COUNT}" == "0" ]]; then
  log "Empty users table detected -- seeding initial data..."
  psql "${DATABASE_URL}" -f "${APP_DIR}/scripts/seed.sql" && log "Seed complete" || log "WARNING: Seed failed -- continuing"
fi

# ── Start / reload ────────────────────────────────────────────────────────────

# If PM2 is not yet managing this app, start it; otherwise do a hot reload.
if pm2 describe nestquest &>/dev/null; then
  log "Reloading application (zero-downtime)..."
  pm2 reload ecosystem.config.cjs --env production --update-env
else
  log "Starting application for the first time..."
  pm2 start ecosystem.config.cjs --env production
fi

# ── Health check ──────────────────────────────────────────────────────────────

log "Waiting for health check..."
sleep 8

MAX_ATTEMPTS=6
for i in $(seq 1 $MAX_ATTEMPTS); do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || echo "000")
  if [[ "${HTTP_STATUS}" == "200" ]]; then
    log "Health check passed (attempt ${i}) -- deploy successful"
    pm2 save
    log "Deploy complete: ${NEW_COMMIT}"
    exit 0
  fi
  log "Attempt ${i}/${MAX_ATTEMPTS}: status ${HTTP_STATUS} -- retrying in 10s"
  sleep 10
done

# ── Auto-rollback on health check failure ─────────────────────────────────────

log "ERROR: Health check failed -- initiating automatic rollback"
PREV_COMMIT=$(cat "${ROLLBACK_MARKER}")
git checkout "${PREV_COMMIT}"
npm ci --omit=dev
npm run build
pm2 reload ecosystem.config.cjs --env production --update-env
sleep 8
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || echo "000")

if [[ "${HTTP_STATUS}" == "200" ]]; then
  log "Rollback successful -- application restored to ${PREV_COMMIT}"
else
  log "CRITICAL: Rollback failed -- manual intervention required"
fi

exit 1
