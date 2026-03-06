#!/usr/bin/env bash
set -euo pipefail

# BudFin Database REINDEX Script
# Usage: ./scripts/maintenance/reindex.sh
# Env: DATABASE_URL
# Cron: 0 3 1 1,4,7,10 * (quarterly, 1st of Jan/Apr/Jul/Oct)

if [ -z "${DATABASE_URL:-}" ]; then
	echo "ERROR: DATABASE_URL is not set" >&2
	exit 1
fi

echo "Starting REINDEX: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Reindex audit_entries table (append-only, benefits from periodic reindex)
psql "${DATABASE_URL}" -c "REINDEX TABLE audit_entries;" 2>&1 || {
	echo "WARNING: REINDEX audit_entries failed (table may not exist yet)" >&2
}

# Reindex monthly_revenue table (frequently queried)
psql "${DATABASE_URL}" -c "REINDEX TABLE monthly_revenue;" 2>&1 || {
	echo "WARNING: REINDEX monthly_revenue failed (table may not exist yet)" >&2
}

echo "REINDEX complete: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
