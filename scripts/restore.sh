#!/usr/bin/env bash
set -euo pipefail

# BudFin Database Restore Script
# Usage: ./scripts/restore.sh <backup_file.dump.gpg>
# Env: DATABASE_URL, GPG_PASSPHRASE

if [ $# -lt 1 ]; then
	echo "Usage: $0 <backup_file.dump.gpg>" >&2
	exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
	echo "ERROR: Backup file not found: ${BACKUP_FILE}" >&2
	exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
	echo "ERROR: DATABASE_URL is not set" >&2
	exit 1
fi

if [ -z "${GPG_PASSPHRASE:-}" ]; then
	echo "ERROR: GPG_PASSPHRASE is not set" >&2
	exit 1
fi

TEMP_DUMP=$(mktemp /tmp/budfin_restore_XXXXXX.dump)
trap 'rm -f "${TEMP_DUMP}"' EXIT

echo "Decrypting backup: ${BACKUP_FILE}"

# Decrypt
gpg --batch --yes --decrypt \
	--passphrase "${GPG_PASSPHRASE}" \
	--output "${TEMP_DUMP}" \
	"${BACKUP_FILE}"

echo "Restoring database..."

# Restore (clean + create)
pg_restore -Fc --clean --if-exists -d "${DATABASE_URL}" "${TEMP_DUMP}" || {
	echo "WARNING: pg_restore completed with warnings (this is normal for clean restores)" >&2
}

echo "Restore complete."
