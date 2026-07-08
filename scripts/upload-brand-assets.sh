#!/usr/bin/env bash
# Upload @grove/brand assets to DigitalOcean Spaces (ADR-009: brand statics → Spaces + CDN).
#
# SVGs are synced as-is; 1600px PNG renders are rasterized on the fly (sharp-cli).
# Content types come from file extensions; everything is public-read with
# immutable cache headers.
#
# Required env (supply via the Grove Secrets Pipeline):
#   SPACES_BUCKET            e.g. grove-assets
#   SPACES_REGION            default nyc3
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   (DO Spaces keys)
#
# Usage:  infisical run -- ./scripts/upload-brand-assets.sh
# After upload, refs resolve as ${NEXT_PUBLIC_ASSETS_URL}/brand/gather/<name>.<ext>
set -euo pipefail

REGION="${SPACES_REGION:-nyc3}"
BUCKET="${SPACES_BUCKET:?SPACES_BUCKET required}"
ENDPOINT="https://${REGION}.digitaloceanspaces.com"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/packages/grove-brand/assets"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp -R "$SRC/." "$STAGE/"

# Rasterize 1600px PNGs next to each SVG
find "$STAGE" -name '*.svg' | while read -r f; do
  npx --yes sharp-cli --input "$f" --output "${f%.svg}.png" resize 1600
done

aws s3 sync "$STAGE" "s3://${BUCKET}/brand/" \
  --endpoint-url "$ENDPOINT" \
  --acl public-read \
  --cache-control "public, max-age=31536000, immutable"

echo "Uploaded. Refs resolve under \${NEXT_PUBLIC_ASSETS_URL}/brand/…"
