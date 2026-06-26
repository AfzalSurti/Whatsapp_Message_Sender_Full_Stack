# Deploy main backend on AWS (EC2)

Recommended: **EC2 + Docker** (Baileys needs disk for `.baileys_auth`, WebSocket, and steady RAM).

## What you need

- AWS account
- MongoDB Atlas URI (with `0.0.0.0/0` or EC2 public IP whitelisted)
- Frontend URL (Vercel) for CORS
- Domain optional (can use EC2 public IP first)

## 1) Launch EC2

1. AWS Console → **EC2 → Launch instance**
2. Name: `wa-sender-backend`
3. AMI: **Ubuntu 24.04 LTS**
4. Instance type: **t3.small** (2 GB RAM minimum; t3.medium if many users)
5. Key pair: create/download `.pem`
6. Security group inbound:
   - `22` SSH — your IP
   - `80` HTTP — `0.0.0.0/0` (if using Nginx)
   - `443` HTTPS — `0.0.0.0/0` (if using SSL)
   - Or `5000` TCP — your IP only for quick testing
7. Storage: **20 GB gp3** (WhatsApp session files)
8. Launch

## 2) SSH into server

```bash
ssh -i "your-key.pem" ubuntu@<EC2_PUBLIC_IP>
```

## 3) Install Docker

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu
newgrp docker
```

## 4) Clone repo and configure env

```bash
git clone https://github.com/YOUR_USER/Whatsapp_Message_Sender_Full_Stack.git
cd Whatsapp_Message_Sender_Full_Stack/backend
cp .env.example .env
nano .env
```

Set production values:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=long-random-secret
JWT_EXPIRES_IN=30d
PORT=5000
CLIENT_URL=https://your-frontend.vercel.app
ALLOWED_ORIGINS=https://your-preview.vercel.app
OPENROUTER_API_KEY=...
MODEL_NAME=openai/gpt-4o-mini
CLIENT_ID=...
CLIENT_SECRET=...
WHATSAPP_AUTH_PATH=/data/.baileys_auth
NODE_ENV=production
```

**Atlas:** whitelist EC2 public IP (or `0.0.0.0/0` for dev).

## 5) Build and run with Docker

From `backend/`:

```bash
docker build -t wa-sender-backend .
docker run -d \
  --name wa-sender-backend \
  --restart unless-stopped \
  -p 5000:5000 \
  --env-file .env \
  -v wa-baileys-auth:/data/.baileys_auth \
  wa-sender-backend
```

Check logs:

```bash
docker logs -f wa-sender-backend
```

You should see:

- `MongoDB Connected: ...`
- `Server running on http://localhost:5000`

Health check:

```bash
curl http://localhost:5000/health
```

## 6) Point frontend to AWS backend

In Vercel (`frontend` project env):

```env
NEXT_PUBLIC_API_URL=http://<EC2_PUBLIC_IP>:5000
NEXT_PUBLIC_WS_URL=ws://<EC2_PUBLIC_IP>:5000
```

For production with HTTPS/domain, use Nginx + SSL (step 7) and then:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
```

Redeploy frontend after changing env.

## 7) Optional: Nginx + HTTPS (recommended)

Install Nginx + Certbot on EC2, proxy to `localhost:5000`.

`/etc/nginx/sites-available/wa-sender`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wa-sender /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

Update `CLIENT_URL` to your Vercel URL and Google OAuth callback to:

`https://api.yourdomain.com/api/auth/google/callback`

## 8) Google OAuth (if used)

Google Cloud Console:

- **Authorized JavaScript origins:** `https://your-frontend.vercel.app`
- **Redirect URI:** `https://api.yourdomain.com/api/auth/google/callback`

## 9) Updates / redeploy

```bash
cd ~/Whatsapp_Message_Sender_Full_Stack
git pull
cd backend
docker build -t wa-sender-backend .
docker stop wa-sender-backend && docker rm wa-sender-backend
docker run -d \
  --name wa-sender-backend \
  --restart unless-stopped \
  -p 5000:5000 \
  --env-file .env \
  -v wa-baileys-auth:/data/.baileys_auth \
  wa-sender-backend
```

Session volume `wa-baileys-auth` keeps WhatsApp logins across redeploys.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| MongoDB timeout | Atlas IP whitelist + correct `MONGODB_URI` |
| CORS error | Set `CLIENT_URL` exactly to Vercel URL (https, no trailing slash) |
| QR / WebSocket fails | Open port 5000 or use Nginx with WebSocket headers; frontend must use `wss://` with HTTPS |
| WhatsApp disconnects after redeploy | Keep Docker volume `-v wa-baileys-auth:/data/.baileys_auth` |
| Out of memory | Upgrade to t3.small or t3.medium |

## Alternative: AWS App Runner / ECS

Possible, but EC2 + Docker is simpler for Baileys file sessions and long-lived WebSockets. Use ECS only if you attach persistent EFS for `/data/.baileys_auth`.
