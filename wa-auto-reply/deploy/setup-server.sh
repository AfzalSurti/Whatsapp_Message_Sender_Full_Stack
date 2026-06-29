#!/bin/bash
# Run ONCE on a fresh Ubuntu 22.04 EC2 instance (as ubuntu user).
# Usage: bash setup-server.sh

set -e

echo "==> Updating system..."
sudo apt update && sudo apt upgrade -y

echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

echo "==> Installing PM2..."
sudo npm install -g pm2

echo "==> Creating WhatsApp session folder (persistent)..."
sudo mkdir -p /var/lib/wa-auto-reply/.baileys_auth
sudo chown -R ubuntu:ubuntu /var/lib/wa-auto-reply

echo "==> Done. Versions:"
node -v
npm -v
pm2 -v

echo ""
echo "Next steps:"
echo "  1. Clone your repo into /home/ubuntu/app"
echo "  2. Create backend/.env and frontend/.env.production"
echo "  3. npm install + npm run build (frontend)"
echo "  4. pm2 start wa-auto-reply/deploy/ecosystem.config.js"
echo "  5. pm2 save && pm2 startup"
