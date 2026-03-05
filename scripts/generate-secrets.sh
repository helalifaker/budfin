#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_DIR="$ROOT_DIR/secrets"

FORCE=false

for arg in "$@"; do
	case "$arg" in
		--force) FORCE=true ;;
		-h|--help)
			echo "Usage: $(basename "$0") [--force]"
			echo ""
			echo "Generates secrets for BudFin deployment:"
			echo "  - EC P-256 JWT key pair (PEM)"
			echo "  - AES-256 salary encryption key (base64)"
			echo ""
			echo "Options:"
			echo "  --force   Overwrite existing secret files"
			echo "  -h, --help  Show this help message"
			exit 0
			;;
		*)
			echo "Unknown option: $arg"
			exit 1
			;;
	esac
done

FILES=(
	"$SECRETS_DIR/jwt_private_key.pem"
	"$SECRETS_DIR/jwt_public_key.pem"
	"$SECRETS_DIR/salary_encryption_key.txt"
)

if [ "$FORCE" = false ]; then
	for file in "${FILES[@]}"; do
		if [ -f "$file" ]; then
			echo "Error: $(basename "$file") already exists. Use --force to overwrite."
			exit 1
		fi
	done
fi

mkdir -p "$SECRETS_DIR"

echo "Generating EC P-256 JWT private key (PKCS#8)..."
openssl ecparam -name prime256v1 -genkey -noout 2>/dev/null \
	| openssl pkcs8 -topk8 -nocrypt -out "$SECRETS_DIR/jwt_private_key.pem"

echo "Extracting JWT public key (SPKI)..."
openssl ec -in "$SECRETS_DIR/jwt_private_key.pem" -pubout \
	-out "$SECRETS_DIR/jwt_public_key.pem" 2>/dev/null

echo "Generating AES-256 salary encryption key (base64)..."
openssl rand -base64 32 > "$SECRETS_DIR/salary_encryption_key.txt"

chmod 600 "$SECRETS_DIR/jwt_private_key.pem"
chmod 600 "$SECRETS_DIR/jwt_public_key.pem"
chmod 600 "$SECRETS_DIR/salary_encryption_key.txt"

echo ""
echo "Secrets generated successfully in $SECRETS_DIR/"
echo "  - jwt_private_key.pem      (EC P-256 private key, PKCS#8 PEM)"
echo "  - jwt_public_key.pem       (EC P-256 public key, SPKI PEM)"
echo "  - salary_encryption_key.txt (AES-256 key, base64-encoded)"
echo ""
echo "WARNING: Keep these files secure. They are excluded from git via .gitignore."
