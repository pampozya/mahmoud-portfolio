#!/bin/bash

# Portfolio deployment script for portfolio.lensmania.ae
# Usage: ./deploy.sh
# One command deploys everything!

set -e

echo "🚀 Deploying to portfolio.lensmania.ae..."

# Step 1: Push code to GitHub
echo "📤 Pushing to GitHub..."
git add .
git commit -m "Deploy - $(date '+%Y-%m-%d %H:%M')" || echo "✓ No changes"
git push origin main

# Step 2: Build frontend
echo "🔨 Building production..."
cd frontend
npm run build
cd ..

# Step 3: Upload to Hostinger
echo "📤 Uploading to Hostinger..."
rsync -avz \
  -e "ssh -i ~/.ssh/hostinger_key -p 65002" \
  frontend/build/ \
  u268111151@145.79.58.45:domains/lensmania.ae/public_html/portfolio/ \
  --delete

echo ""
echo "✅ Deployment complete!"
echo "🎉 Live: https://portfolio.lensmania.ae"
echo ""
