#!/usr/bin/env bash
# One-time EC2 setup. Run on a fresh Ubuntu 24.04 server as user `ubuntu`.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/AfzalSurti/Whatsapp_Message_Sender_Full_Stack.git}"
APP_DIR="${APP_DIR:-$HOME/Whatsapp_Message_Sender_Full_Stack}"

echo "==> Installing Docker..."
sudo apt-get update
sudo apt-get install -y docker.io git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"

echo "==> Cloning repository..."
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "Repo already exists at $APP_DIR"
fi

cd "$APP_DIR/backend"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "IMPORTANT: Edit backend/.env with production values before first deploy:"
  echo "  nano $APP_DIR/backend/.env"
  echo ""
fi

chmod +x deploy-aws.sh

echo ""
echo "Bootstrap complete."
echo "Next steps:"
echo "  1. Log out and SSH back in (so docker group applies), OR run: newgrp docker"
echo "  2. Edit .env: nano $APP_DIR/backend/.env"
echo "  3. First deploy: cd $APP_DIR/backend && ./deploy-aws.sh"
echo "  4. Add GitHub secrets (EC2_HOST, EC2_USER, EC2_SSH_KEY) for auto-deploy on push"
