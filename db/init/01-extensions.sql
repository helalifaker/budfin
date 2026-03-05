-- Enable pgcrypto for salary field encryption (AES-256 via pgp_sym_encrypt)
-- Idempotent: CREATE EXTENSION IF NOT EXISTS is safe to re-run
CREATE EXTENSION IF NOT EXISTS pgcrypto;
