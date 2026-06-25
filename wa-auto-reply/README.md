# WA Auto Reply — Standalone App

A **completely separate** WhatsApp Auto Reply + AI Templates application. It does not share database, API, or sessions with the main **WA Sender** bulk messaging app in the parent repo.

## What's included

- User auth (signup, login, Google OAuth)
- WhatsApp QR connect / disconnect / status (Baileys)
- WebSocket for live QR updates
- **Auto Reply** — smart mode, contact rules, logs
- **AI Templates** — intent workflows, conversations, leads
- **Settings** — business profile & AI personality
- Contact groups API (for saved contacts in auto reply picker)

## What's NOT included

- Bulk message sending
- Campaign scheduler
- Message templates
- API keys
- Live feed / send history

## Folder structure

```
wa-auto-reply/
├── backend/     Express API (port 5001)
└── frontend/    Next.js app (port 3001)
```

## Setup

### 1. Backend

```bash
cd wa-auto-reply/backend
cp .env.example .env
# Edit .env — use a separate MONGODB_URI (e.g. wa_auto_reply)
npm install
npm run dev
```

### 2. Frontend

```bash
cd wa-auto-reply/frontend
cp .env.example .env.local
npm install
npm run dev
```

Open **http://localhost:3001**

## Environment

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | **Must be different** from main app DB |
| `PORT` | Backend port (default `5001`) |
| `CLIENT_URL` | Frontend URL for CORS (default `http://localhost:3001`) |
| `JWT_SECRET` | Auth signing secret |
| `OPENROUTER_API_KEY` | Required for AI replies |
| `NEXT_PUBLIC_API_URL` | Backend URL for frontend |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (`ws://localhost:5001`) |

## Isolation from main app

- Separate MongoDB database
- Separate Baileys auth folder (`backend/.baileys_auth`)
- Separate ports (5001 / 3001 vs 5000 / 3000)
- No imports or API calls to the main `frontend/` or `backend/`

## Production

Deploy backend and frontend independently. Set `CLIENT_URL`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_WS_URL` to your production domains. Configure Google OAuth callback to your backend `/api/auth/google/callback`.
