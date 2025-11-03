#!/usr/bin/env bash
set -euo pipefail

# Helper to apply cors.json to Cloudflare R2 via S3-compatible API (aws-cli).
# It will prefer AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, else fall back to
# CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY from environment.
# Requires aws-cli v2 configured with --endpoint-url for R2.

AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-${CLOUDFLARE_R2_ACCESS_KEY_ID:-}}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-${CLOUDFLARE_R2_SECRET_ACCESS_KEY:-}}
ENDPOINT_URL=${ENDPOINT_URL:-${CLOUDFLARE_R2_ENDPOINT:-}}
BUCKET_NAME=${BUCKET_NAME:-${CLOUDFLARE_R2_BUCKET_NAME:-}}

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "ERROR: AWS credentials not provided. Export AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or set CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY in the environment."
  exit 1
fi
if [ -z "$ENDPOINT_URL" ] || [ -z "$BUCKET_NAME" ]; then
  echo "ERROR: R2 endpoint or bucket name not provided. Set CLOUDFLARE_R2_ENDPOINT and CLOUDFLARE_R2_BUCKET_NAME in the environment or export ENDPOINT_URL and BUCKET_NAME."
  exit 1
fi

echo "Applying CORS to bucket: $BUCKET_NAME at endpoint: $ENDPOINT_URL"

# Use aws-cli with provided env creds. This command will call the S3 API put-bucket-cors.
AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  aws s3api put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --cors-configuration file://cors.json \
    --endpoint-url "$ENDPOINT_URL" \
    --region auto

if [ $? -eq 0 ]; then
  echo "CORS applied successfully. Run the curl OPTIONS test suggested in the README to verify."
else
  echo "Failed to apply CORS. Check credentials and endpoint, and run the command with --debug to see details."
fi
