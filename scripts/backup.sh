#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# NestQuest — PostgreSQL Backup to S3
#
# Usage:
#   ./scripts/backup.sh
#
# Required environment variables:
#   DATABASE_URL     — postgresql://user:pass@host:5432/dbname
#   S3_BUCKET        — e.g. nestquest-backups
#   AWS_REGION       — e.g. me-central-1
#
# Optional:
#   RETENTION_DAYS   — how many days to keep backups (default: 30)
#   BACKUP_PREFIX    — S3 key prefix (default: db-backups)
#
# Cron (daily at 2:00 AM server time):
#   0 2 * * * /home/ubuntu/nestquest/scripts/backup.sh >> /var/log/nestquest-backup.log 2>&1
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ─────────────────────────────────────────────

RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_PREFIX="${BACKUP_PREFIX:-db-backups}"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="/tmp/nestquest_${TIMESTAMP}.dump"

# ── Validate required vars ─────────────────────────────

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[backup] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

if [[ -z "${S3_BUCKET:-}" ]]; then
  echo "[backup] ERROR: S3_BUCKET is not set" >&2
  exit 1
fi

echo "[backup] Starting backup at $(date)"

# ── Dump database ──────────────────────────────────────

echo "[backup] Running pg_dump..."
pg_dump \
  --format=custom \
  --compress=9 \
  --no-password \
  --verbose \
  "${DATABASE_URL}" \
  --file="${BACKUP_FILE}"

BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "[backup] Dump complete — size: ${BACKUP_SIZE}"

# ── Upload to S3 ───────────────────────────────────────

S3_KEY="${BACKUP_PREFIX}/nestquest_${TIMESTAMP}.dump"
echo "[backup] Uploading to s3://${S3_BUCKET}/${S3_KEY} ..."

aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/${S3_KEY}" \
  --region "${AWS_REGION:-me-central-1}" \
  --storage-class STANDARD_IA \
  --metadata "timestamp=${TIMESTAMP},host=$(hostname)"

echo "[backup] Upload complete"

# ── Cleanup local file ─────────────────────────────────

rm -f "${BACKUP_FILE}"
echo "[backup] Local temp file removed"

# ── Enforce retention policy ───────────────────────────

echo "[backup] Removing backups older than ${RETENTION_DAYS} days..."

CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || \
              date -v-${RETENTION_DAYS}d +%Y-%m-%d)

aws s3 ls "s3://${S3_BUCKET}/${BACKUP_PREFIX}/" \
  --region "${AWS_REGION:-me-central-1}" | \
while read -r LINE; do
  FILE_DATE=$(echo "${LINE}" | awk '{print $1}')
  FILE_NAME=$(echo "${LINE}" | awk '{print $4}')

  if [[ -n "${FILE_DATE}" ]] && [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
    echo "[backup] Deleting old backup: ${FILE_NAME} (${FILE_DATE})"
    aws s3 rm "s3://${S3_BUCKET}/${BACKUP_PREFIX}/${FILE_NAME}" \
      --region "${AWS_REGION:-me-central-1}"
  fi
done

echo "[backup] Backup job completed successfully at $(date)"
