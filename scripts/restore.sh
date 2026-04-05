#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# NestQuest — Restore PostgreSQL from S3 Backup
#
# Usage:
#   ./scripts/restore.sh <s3-key-or-date>
#
# Examples:
#   ./scripts/restore.sh db-backups/nestquest_2026-04-01_02-00-00.dump
#   ./scripts/restore.sh latest          ← restores the most recent backup
#
# Required environment variables:
#   DATABASE_URL    — target database (will be DROPPED and recreated)
#   S3_BUCKET       — e.g. nestquest-backups
#   AWS_REGION      — e.g. me-central-1
#
# ⚠️  WARNING: This will DROP and recreate the target database.
#     Run on a staging environment first to verify the backup integrity.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Validate ───────────────────────────────────────────

if [[ -z "${DATABASE_URL:-}" || -z "${S3_BUCKET:-}" ]]; then
  echo "[restore] ERROR: DATABASE_URL and S3_BUCKET must be set" >&2
  exit 1
fi

if [[ -z "${1:-}" ]]; then
  echo "[restore] Usage: $0 <s3-key | latest>" >&2
  exit 1
fi

BACKUP_PREFIX="${BACKUP_PREFIX:-db-backups}"
LOCAL_FILE="/tmp/nestquest_restore.dump"

# ── Resolve S3 key ─────────────────────────────────────

if [[ "$1" == "latest" ]]; then
  echo "[restore] Finding latest backup in s3://${S3_BUCKET}/${BACKUP_PREFIX}/ ..."
  S3_KEY=$(aws s3 ls "s3://${S3_BUCKET}/${BACKUP_PREFIX}/" \
    --region "${AWS_REGION:-me-central-1}" \
    | sort | tail -1 | awk '{print $4}')

  if [[ -z "${S3_KEY}" ]]; then
    echo "[restore] ERROR: No backups found in s3://${S3_BUCKET}/${BACKUP_PREFIX}/" >&2
    exit 1
  fi

  S3_KEY="${BACKUP_PREFIX}/${S3_KEY}"
  echo "[restore] Latest backup: ${S3_KEY}"
else
  S3_KEY="$1"
fi

# ── Download from S3 ───────────────────────────────────

echo "[restore] Downloading s3://${S3_BUCKET}/${S3_KEY} ..."
aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "${LOCAL_FILE}" \
  --region "${AWS_REGION:-me-central-1}"

echo "[restore] Download complete ($(du -sh "${LOCAL_FILE}" | cut -f1))"

# ── Parse database name from URL ───────────────────────

DB_NAME=$(echo "${DATABASE_URL}" | sed 's/.*\///')
DB_HOST=$(echo "${DATABASE_URL}" | sed 's|postgresql://||' | sed 's|:.*||' | sed 's|.*@||')

echo "[restore] Target database: ${DB_NAME} on ${DB_HOST}"
echo ""
echo "⚠️  This will DROP and recreate database '${DB_NAME}'."
read -p "Type 'yes' to confirm: " CONFIRM

if [[ "${CONFIRM}" != "yes" ]]; then
  echo "[restore] Aborted."
  rm -f "${LOCAL_FILE}"
  exit 0
fi

# ── Drop and recreate DB ───────────────────────────────

echo "[restore] Dropping existing database..."
psql "${DATABASE_URL%/*}/postgres" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" 2>/dev/null || true
psql "${DATABASE_URL%/*}/postgres" -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql "${DATABASE_URL%/*}/postgres" -c "CREATE DATABASE ${DB_NAME};"

echo "[restore] Database recreated. Restoring data..."

# ── Restore ────────────────────────────────────────────

pg_restore \
  --dbname="${DATABASE_URL}" \
  --no-password \
  --verbose \
  --single-transaction \
  "${LOCAL_FILE}"

echo "[restore] Restore complete"

# ── Cleanup ────────────────────────────────────────────

rm -f "${LOCAL_FILE}"
echo "[restore] Local temp file removed"
echo "[restore] Restore finished at $(date)"
echo ""
echo "Next steps:"
echo "  1. Verify: psql \${DATABASE_URL} -c 'SELECT COUNT(*) FROM users;'"
echo "  2. Restart the application: pm2 restart nestquest"
