#!/usr/bin/env bash
set -euo pipefail

# BudFin Database VACUUM ANALYZE Script
# Usage: ./scripts/maintenance/vacuum.sh
# Env: DATABASE_URL
# Cron: 0 3 * * 0 (weekly, Sunday 03:00 AST)

if [ -z "${DATABASE_URL:-}" ]; then
	echo "ERROR: DATABASE_URL is not set" >&2
	exit 1
fi

echo "Starting VACUUM ANALYZE on all tables: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

psql "${DATABASE_URL}" -c "VACUUM ANALYZE;" 2>&1

echo "VACUUM ANALYZE complete: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
