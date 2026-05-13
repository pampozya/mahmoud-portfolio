#!/bin/bash
# Deploys the pending-work tracker to lensmania.ae public_html root.
# Usage: ./tracker/deploy-tracker.sh
set -euo pipefail

HOST="u268111151@145.79.58.45"
PORT="65002"
KEY="$HOME/.ssh/hostinger_key"
REMOTE_DIR="domains/lensmania.ae/public_html"

cd "$(dirname "$0")"

echo "Uploading tracker files to $HOST:$REMOTE_DIR/ ..."
scp -i "$KEY" -P "$PORT" \
  api.php \
  all-pending-tracker.html \
  manifest.json \
  sw.js \
  tracker-icon-192.png \
  tracker-icon-512.png \
  tracker-icon-512-maskable.png \
  tracker-apple-touch.png \
  "$HOST:$REMOTE_DIR/"

echo "Ensuring pending-work-data.json is writable (creating if missing)..."
ssh -i "$KEY" -p "$PORT" "$HOST" "cd $REMOTE_DIR && [ -f pending-work-data.json ] || echo '[]' > pending-work-data.json && chmod 664 pending-work-data.json && ls -la api.php all-pending-tracker.html pending-work-data.json"

echo ""
echo "Done."
echo "  HTML: https://lensmania.ae/all-pending-tracker.html"
echo "  API:  https://lensmania.ae/api.php"
