#!/usr/bin/env bash
set -euo pipefail

# BudFin mkcert Setup Script
# Generates self-signed TLS certificates for local development
# Prerequisites: mkcert must be installed (brew install mkcert)

CERT_DIR="nginx/ssl"

if ! command -v mkcert &> /dev/null; then
	echo "ERROR: mkcert is not installed." >&2
	echo "Install with: brew install mkcert (macOS) or see https://github.com/FiloSottile/mkcert" >&2
	exit 1
fi

# Install local CA if not already done
mkcert -install 2>/dev/null || true

# Create certificate directory
mkdir -p "${CERT_DIR}"

# Generate certificates for localhost
mkcert -cert-file "${CERT_DIR}/fullchain.pem" \
       -key-file "${CERT_DIR}/privkey.pem" \
       localhost 127.0.0.1 ::1

echo "Certificates generated in ${CERT_DIR}/"
echo "  fullchain.pem - certificate"
echo "  privkey.pem   - private key"
echo ""
echo "Start dev server with:"
echo "  docker compose -f docker-compose.yml -f docker-compose.dev.yml up"
