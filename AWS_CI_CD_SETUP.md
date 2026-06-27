# AWS + CI/CD setup (beginner guide)

Auto-deploy the **main backend** to AWS EC2 whenever you push to `main` on GitHub.

Repo: `https://github.com/AfzalSurti/Whatsapp_Message_Sender_Full_Stack`

---

## Overview

```
You push to GitHub (main)
        ↓
GitHub Actions runs
        ↓
SSH into your EC2 server
        ↓
git pull + ./deploy-aws.sh
        ↓
Backend live on AWS
```

**Frontend (Vercel)** can stay separate — it auto-deploys on push if already connected.

---

## Part 1 — AWS account & EC2 server (one time)

### Step 1: Create AWS account
1. Go to [https://aws.amazon.com](https://aws.amazon.com)
2. Sign up (needs card; free tier covers t3.small for 12 months in many regions)

### Step 2: Open EC2
1. AWS Console → search **EC2** → open it
2. Top-right: pick a region close to you (e.g. **Asia Pacific (Mumbai) ap-south-1**)

### Step 3: Create key pair (for SSH)
1. EC2 left menu → **Key Pairs** → **Create key pair**
2. Name: `wa-sender-key`
3. Type: **RSA**, format: **.pem**
4. Download the `.pem` file — **keep it safe** (you need it for SSH + GitHub)

### Step 4: Launch instance
1. EC2 → **Instances** → **Launch instance**
2. Settings:
   - **Name:** `wa-sender-backend`
   - **AMI:** Ubuntu Server 24.04 LTS
   - **Instance type:** `t3.small` (2 GB RAM — required for WhatsApp)
   - **Key pair:** `wa-sender-key`
   - **Network / Security group:** Create new → allow:
     - SSH `22` — **My IP** (safer) or Anywhere for testing
     - HTTP `80` — Anywhere (for Nginx later)
     - HTTPS `443` — Anywhere (for SSL later)
     - Custom TCP `5000` — Anywhere (quick test; remove later if using Nginx)
   - **Storage:** 20 GB gp3
3. **Launch instance**
4. Wait until **Instance state** = **Running**
5. Copy **Public IPv4 address** (e.g. `3.110.x.x`) — this is your `EC2_HOST`

### Step 5: MongoDB Atlas whitelist
1. Atlas → **Network Access** → **Add IP Address**
2. Add your EC2 **public IP** (or `0.0.0.0/0` for dev only)
3. Save

---

## Part 2 — First setup on EC2 (one time)

### Step 6: SSH into server

**Windows (PowerShell):**
```powershell
ssh -i "C:\path\to\wa-sender-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

First time: type `yes` if asked about fingerprint.

### Step 7: Run bootstrap script
```bash
curl -fsSL https://raw.githubusercontent.com/AfzalSurti/Whatsapp_Message_Sender_Full_Stack/main/backend/scripts/ec2-bootstrap.sh -o bootstrap.sh
chmod +x bootstrap.sh
./bootstrap.sh
```

Or if repo is private, clone manually after setting up deploy key / PAT.

Then:
```bash
exit
```
SSH in again (so Docker permissions work).

### Step 8: Create production `.env` on server
```bash
nano ~/Whatsapp_Message_Sender_Full_Stack/backend/.env
```

Paste and fill (use your real values):

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/wa_sender?retryWrites=true&w=majority
JWT_SECRET=long-random-secret-here
JWT_EXPIRES_IN=30d
PORT=5000
CLIENT_URL=https://YOUR-VERCEL-APP.vercel.app
ALLOWED_ORIGINS=
OPENROUTER_API_KEY=your-key
MODEL_NAME=openai/gpt-4o-mini
CLIENT_ID=your-google-client-id
CLIENT_SECRET=your-google-client-secret
WHATSAPP_AUTH_PATH=/data/.baileys_auth
NODE_ENV=production
```

Save: `Ctrl+O`, Enter, `Ctrl+X`

**Password in URI:** if it has `%` or `@`, URL-encode it (`encodeURIComponent`).

### Step 9: First manual deploy
```bash
cd ~/Whatsapp_Message_Sender_Full_Stack/backend
./deploy-aws.sh
```

Check:
```bash
curl http://localhost:5000/health
```

You should see JSON with `"status":"ok"`.

From your PC browser (if port 5000 is open):
`http://YOUR_EC2_PUBLIC_IP:5000/health`

---

## Part 3 — GitHub CI/CD (auto deploy on push)

### Step 10: Add GitHub Secrets
1. GitHub → your repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** for each:

| Secret name | Value |
|-------------|--------|
| `EC2_HOST` | EC2 public IP, e.g. `3.110.12.34` |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Full contents of `wa-sender-key.pem` file (copy entire file including `BEGIN`/`END` lines) |

Optional:

| Secret | Value |
|--------|--------|
| _(none required beyond the three above)_ | App path is `~/Whatsapp_Message_Sender_Full_Stack` on EC2 |

### Step 11: Push the workflow file
The repo includes `.github/workflows/deploy-backend.yml`.

After you commit and push to `main`:
- Any change under `backend/` triggers auto-deploy
- Or run manually: GitHub → **Actions** → **Deploy Backend to AWS EC2** → **Run workflow**

### Step 12: Watch deployment
1. GitHub → **Actions** tab
2. Click the latest run
3. Green check = deployed

On EC2 you can verify:
```bash
docker logs -f wa-sender-backend
```

---

## Part 4 — Connect frontend (Vercel)

In Vercel project env:

```env
NEXT_PUBLIC_API_URL=http://YOUR_EC2_PUBLIC_IP:5000
NEXT_PUBLIC_WS_URL=ws://YOUR_EC2_PUBLIC_IP:5000
```

Redeploy frontend.

Later with domain + HTTPS:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
```

Set backend `CLIENT_URL` to your exact Vercel URL.

---

## What deploys automatically vs manually

| Action | Auto? |
|--------|-------|
| Push to `main` changing `backend/**` | Yes — GitHub Actions deploys |
| Push only frontend changes | No backend deploy (by design) |
| Change `.env` on server | Manual — edit on EC2, then `./deploy-aws.sh` |
| Change Vercel env vars | Manual redeploy on Vercel |

---

## Troubleshooting

### GitHub Action fails: "connection refused"
- EC2 security group must allow SSH (22) from GitHub Actions IPs — easiest: allow `0.0.0.0/0` on port 22 temporarily, or use a self-hosted runner (advanced)

### GitHub Action fails: "permission denied"
- `EC2_SSH_KEY` must be the full private key, no extra spaces
- `EC2_USER` must be `ubuntu` for Ubuntu AMI

### Deploy works but MongoDB fails
- Whitelist EC2 IP in Atlas
- Fix `MONGODB_URI` encoding

### WhatsApp sessions lost after deploy
- Deploy script uses Docker volume `wa-baileys-auth` — don’t remove that volume

### Private GitHub repo
- On EC2, use SSH deploy key or Personal Access Token to clone:
  ```bash
  git clone git@github.com:AfzalSurti/Whatsapp_Message_Sender_Full_Stack.git
  ```

---

## Checklist

- [ ] EC2 running (t3.small, Ubuntu 24.04)
- [ ] Key pair downloaded
- [ ] Security group: 22, 5000 (and 80/443 if using Nginx)
- [ ] Atlas IP whitelisted
- [ ] Bootstrap + `.env` on server
- [ ] First `./deploy-aws.sh` works + `/health` OK
- [ ] GitHub secrets: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`
- [ ] Workflow pushed to `main`
- [ ] Vercel env points to EC2 backend

When all checked, every `git push` to `main` that touches `backend/` will redeploy automatically.
