# Deployment Guide

> **AWS + auto-deploy (CI/CD):** see [AWS_CI_CD_SETUP.md](./AWS_CI_CD_SETUP.md)  
> **AWS manual Docker deploy:** see [DEPLOYMENT_AWS.md](./DEPLOYMENT_AWS.md)

This app is split into two deployable parts:

- Frontend: `frontend/` on Vercel
- Backend: `backend/` on Render

## 1) Deploy the backend to Render (do this first)

1. Create a new Render Web Service from the repository.
2. Set the root directory to `backend`.
3. Set the build command to `npm install && npm run build` (installs Chrome for Puppeteer).
4. Set the start command to `npm start`.
5. **Use at least the Standard plan (2 GB RAM).** The free tier (512 MB) often cannot run headless Chrome + WhatsApp Web and the service will restart when you click Connect.
6. Add these environment variables in Render:

| Variable | Example | Required |
|----------|---------|----------|
| `MONGODB_URI` | MongoDB Atlas connection string | Yes |
| `JWT_SECRET` | long random secret | Yes |
| `JWT_EXPIRES_IN` | `30d` | Yes |
| `CLIENT_URL` | `https://whatsapp-message-sender-full-stack.vercel.app` | Yes |
| `ALLOWED_ORIGINS` | `https://your-preview.vercel.app` | Optional (comma-separated extra Vercel preview URLs) |
| `OPENROUTER_API_KEY` | your key | If using AI |
| `MODEL_NAME` | e.g. `openai/gpt-4o-mini` | If using AI |
| `CLIENT_ID` / `CLIENT_SECRET` | Google OAuth | If using Google login |

**Important:** `CLIENT_URL` must match your Vercel frontend URL **exactly** (https, no trailing slash). If CORS errors appear in the browser console, this value is wrong or missing.

Optional:

- `SKIP_SESSION_RECOVERY=true` — skip auto-recovering WhatsApp sessions on boot (helps debugging on low-memory instances).

After deploy, check Render logs for:

```
✅ CORS allowed origins: https://your-frontend.vercel.app
Chrome executable: /opt/render/project/src/backend/.puppeteer-cache/...
```

## 2) Deploy the frontend to Vercel

1. Import the repository into Vercel.
2. Set the project root directory to `frontend`.
3. Build command: `npm run build`
4. Add environment variables:

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `wss://your-backend.onrender.com` |

5. Redeploy after the backend URL is live.

## 3) Configure Google OAuth (if enabled)

In Google Cloud Console:

- Authorized redirect URI: `https://your-backend.onrender.com/api/auth/google/callback`
- Authorized JavaScript origin: `https://your-frontend.vercel.app`

## 4) WhatsApp session storage

Sessions are stored in **MongoDB** via RemoteAuth (not on Render disk). No persistent disk is required for WhatsApp login state.

## 5) Troubleshooting production

### CORS blocked / `No Access-Control-Allow-Origin`

- Set `CLIENT_URL` on Render to your exact Vercel URL.
- Redeploy the backend after changing env vars.
- Check logs for `CORS blocked origin:` — it shows what the browser sent vs what is allowed.

### QR never appears / "Waiting for QR code..."

- Upgrade Render to **Standard (2 GB)** or higher.
- Logs like `Timed out after 30000 ms while waiting for the WS endpoint` mean Chrome failed to start (usually out of memory).
- Logs like `==> Running 'npm start'` right after Connect mean the process crashed and restarted.

### WebSocket disconnects

- Ensure `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`).
- Render free tier spin-down can drop connections; Standard keeps the service warm.

## Local development

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- `NEXT_PUBLIC_API_URL=http://localhost:5000`
- `NEXT_PUBLIC_WS_URL=ws://localhost:5000`
- `CLIENT_URL=http://localhost:3000`
