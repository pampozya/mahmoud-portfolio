#!/bin/bash
# Deploys the Cinemagic tracker to lensmania.ae public_html root.
# Usage: ./tracker/deploy-cinemagic.sh
set -euo pipefail

HOST="u268111151@145.79.58.45"
PORT="65002"
KEY="$HOME/.ssh/hostinger_key"
REMOTE_DIR="domains/lensmania.ae/public_html"

cd "$(dirname "$0")"

echo "Uploading cinemagic-api.php and cinemagic-tracker.html to $HOST:$REMOTE_DIR/ ..."
scp -i "$KEY" -P "$PORT" \
  cinemagic-api.php cinemagic-tracker.html \
  "$HOST:$REMOTE_DIR/"

echo "Ensuring cinemagic-data.json is writable (creating if missing)..."
ssh -i "$KEY" -p "$PORT" "$HOST" "cd $REMOTE_DIR && [ -f cinemagic-data.json ] || echo '[]' > cinemagic-data.json && chmod 664 cinemagic-data.json && ls -la cinemagic-api.php cinemagic-tracker.html cinemagic-data.json"

echo ""
echo "Done."
echo "  HTML: https://lensmania.ae/cinemagic-tracker.html"
echo "  API:  https://lensmania.ae/cinemagic-api.php"
