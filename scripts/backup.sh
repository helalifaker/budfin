#!/usr/bin/env bash
set -euo pipefail

# BudFin Database Backup Script
# Usage: ./scripts/backup.sh
# Env: DATABASE_URL, BACKUP_DIR (default: /var/backups/budfin), GPG_PASSPHRASE
# Designed for cron: 0 2 * * * /opt/budfin/scripts/backup.sh

BACKUP_DIR="${BACKUP_DIR:-/var/backups/budfin}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_SHORT=$(date +%Y-%m-%d)
DAY_OF_MONTH=$(date +%d)
MONTH=$(date +%m)
DUMP_FILE="${BACKUP_DIR}/daily/budfin_${TIMESTAMP}.dump"
ENCRYPTED_FILE="${DUMP_FILE}.gpg"

# Validate required environment
if [ -z "${DATABASE_URL:-}" ]; then
	echo "ERROR: DATABASE_URL is not set" >&2
	exit 1
fi

if [ -z "${GPG_PASSPHRASE:-}" ]; then
	echo "ERROR: GPG_PASSPHRASE is not set" >&2
	exit 1
fi

# Create backup directories
mkdir -p "${BACKUP_DIR}"/{daily,monthly,annual}

echo "Starting backup: ${TIMESTAMP}"

# Dump database in custom format
pg_dump -Fc "${DATABASE_URL}" > "${DUMP_FILE}"

# GPG symmetric encrypt (AES-256)
gpg --batch --yes --symmetric --cipher-algo AES256 \
	--passphrase "${GPG_PASSPHRASE}" \
	--output "${ENCRYPTED_FILE}" \
	"${DUMP_FILE}"

# Remove unencrypted dump
rm -f "${DUMP_FILE}"

echo "Backup created: ${ENCRYPTED_FILE}"

# Monthly backup (1st of month)
if [ "${DAY_OF_MONTH}" = "01" ]; then
	cp "${ENCRYPTED_FILE}" "${BACKUP_DIR}/monthly/budfin_${DATE_SHORT}.dump.gpg"
	echo "Monthly backup copied"
fi

# Annual backup (Jan 1st)
if [ "${DAY_OF_MONTH}" = "01" ] && [ "${MONTH}" = "01" ]; then
	cp "${ENCRYPTED_FILE}" "${BACKUP_DIR}/annual/budfin_${DATE_SHORT}.dump.gpg"
	echo "Annual backup copied"
fi

# Retention: 30 days daily, 12 months monthly, 10 years annual
find "${BACKUP_DIR}/daily" -name "*.dump.gpg" -mtime +30 -delete 2>/dev/null || true
find "${BACKUP_DIR}/monthly" -name "*.dump.gpg" -mtime +365 -delete 2>/dev/null || true
find "${BACKUP_DIR}/annual" -name "*.dump.gpg" -mtime +3650 -delete 2>/dev/null || true

echo "Backup complete. Retention policy applied."
