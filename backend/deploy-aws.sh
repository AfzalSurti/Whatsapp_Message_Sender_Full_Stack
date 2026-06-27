#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/Whatsapp_Message_Sender_Full_Stack}"
BACKEND_DIR="$APP_DIR/backend"
CONTAINER_NAME="wa-sender-backend"
IMAGE_NAME="wa-sender-backend"
VOLUME_NAME="wa-baileys-auth"

if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "Missing $BACKEND_DIR/.env — copy .env.example and fill values first."
  exit 1
fi

cd "$BACKEND_DIR"

echo "Building Docker image..."
docker build -t "$IMAGE_NAME" .

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Stopping existing container..."
  docker stop "$CONTAINER_NAME" >/dev/null || true
  docker rm "$CONTAINER_NAME" >/dev/null || true
fi

echo "Starting container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 5000:5000 \
  --env-file .env \
  -v "$VOLUME_NAME:/data/.baileys_auth" \
  "$IMAGE_NAME"

echo "Done. Logs:"
docker logs --tail 30 "$CONTAINER_NAME"

if ! curl -fsS "http://127.0.0.1:5000/health" >/dev/null; then
  echo "WARNING: /health check failed — review container logs."
  exit 1
fi

echo "Health check passed."
