#!/usr/bin/env bash
set -euo pipefail

# Apply Cloudflare D1 migrations using an API token (no wrangler login; no credentials in wrangler.toml)
# Requirements:
#   - CLOUDFLARE_API_TOKEN  (scopes: Account:Read, D1 Database:Edit)
#   - CF_ACCOUNT_ID          (your Cloudflare account ID)
# Optional:
#   - DB_NAME (defaults to "odubo")
#   - MIGRATIONS_DIR (defaults to "./database/migrations")
# Notes:
#   This uses `wrangler d1 migrations apply <DB_NAME> --remote --account-id <...>`
#   Wrangler will look up the D1 database by name via the account using the API token.

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID is required}"

DB_NAME=${DB_NAME:-odubo}
MIGRATIONS_DIR=${MIGRATIONS_DIR:-./database/migrations}

# Verify wrangler is available
if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found on PATH" >&2
  exit 1
fi

# Show a short plan
echo "Applying D1 migrations"
echo "  Account ID:   ${CF_ACCOUNT_ID}"
echo "  Database:     ${DB_NAME}"
echo "  Migrations:   ${MIGRATIONS_DIR}"

# Run apply using API token (env var) and explicit account ID
# If you see a failure about migrations_dir, ensure wrangler supports --migrations-dir with your version.
# You can upgrade wrangler: npm i -D wrangler@latest

npx wrangler d1 migrations apply "${DB_NAME}" \
  --remote \
  --account-id "${CF_ACCOUNT_ID}" \
  --migrations-dir "${MIGRATIONS_DIR}"

echo "✅ D1 migrations applied"
