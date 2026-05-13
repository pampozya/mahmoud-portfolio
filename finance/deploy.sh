#!/bin/bash
set -e

# Finance Tracker Deployment Script
# Deploys to lensmania.ae/finance/ on Hostinger

HOSTINGER_USER="u268111151"
HOSTINGER_HOST="145.79.58.45"
HOSTINGER_PORT="65002"
HOSTINGER_KEY="$HOME/.ssh/hostinger_key"
REMOTE_PATH="/home/$HOSTINGER_USER/domains/lensmania.ae/public_html/finance"

echo "🚀 Deploying Finance Tracker to $HOSTINGER_HOST:$REMOTE_PATH..."

# Create remote directory if it doesn't exist
ssh -i "$HOSTINGER_KEY" -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_HOST" \
    "mkdir -p $REMOTE_PATH && chmod 755 $REMOTE_PATH"

# Copy main files
echo "📁 Copying files..."
scp -i "$HOSTINGER_KEY" -P "$HOSTINGER_PORT" \
    index.html api.php sw.js manifest.json \
    "$HOSTINGER_USER@$HOSTINGER_HOST:$REMOTE_PATH/"

# Copy icon files
scp -i "$HOSTINGER_KEY" -P "$HOSTINGER_PORT" \
    icon-192.png icon-512.png icon-512-maskable.png apple-touch.png \
    "$HOSTINGER_USER@$HOSTINGER_HOST:$REMOTE_PATH/"

# Copy seed data
scp -i "$HOSTINGER_KEY" -P "$HOSTINGER_PORT" \
    data-seed.json \
    "$HOSTINGER_USER@$HOSTINGER_HOST:$REMOTE_PATH/"

# Set permissions on remote
echo "🔒 Setting permissions..."
ssh -i "$HOSTINGER_KEY" -p "$HOSTINGER_PORT" "$HOSTINGER_USER@$HOSTINGER_HOST" << 'EOF'
path="/home/u268111151/domains/lensmania.ae/public_html/finance"
chmod 644 "$path"/*.html "$path"/*.php "$path"/*.js "$path"/*.json "$path"/*.png 2>/dev/null || true
if [ ! -f "$path/finance-data.json" ]; then
    cp "$path/data-seed.json" "$path/finance-data.json" 2>/dev/null || true
fi
chmod 664 "$path/finance-data.json" 2>/dev/null || true
EOF

echo "✅ Deployment complete!"
echo "🌐 Access at: https://lensmania.ae/finance/"
