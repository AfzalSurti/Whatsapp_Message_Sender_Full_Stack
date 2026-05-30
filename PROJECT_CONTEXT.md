# Project Context

## Project Overview

This repository contains a WhatsApp bulk messaging SaaS-style application.

- Frontend: Next.js app in `frontend/`
- Backend: Express API in `backend/`
- Database: MongoDB through Mongoose
- Realtime updates: WebSocket server attached to the Express HTTP server
- WhatsApp integration: `whatsapp-web.js` with per-user `LocalAuth` sessions
- AI message generation: OpenRouter chat completion API
- Authentication: JWT local auth plus optional Google OAuth
- Deployment target: frontend on Vercel, backend on Render

The file `whatsapp-saas-platform.html` is a large standalone/static HTML artifact and does not appear to be wired into the active Next.js runtime.

## Folder Structure

### `backend/`

Main backend application.

- Entry point: `backend/index.js`
- Uses Express, MongoDB, WebSocket, Passport, JWT, and `whatsapp-web.js`
- Starts the HTTP API, attaches WebSocket, connects MongoDB, recovers WhatsApp sessions, and starts the scheduler

### `backend/config/`

- `db.js`: MongoDB connection with retry/backoff
- `passport.js`: Google OAuth strategy setup when `CLIENT_ID` and `CLIENT_SECRET` exist

### `backend/routes/`

API route definitions:

- `/api/auth`
- `/api/whatsapp`
- `/api/ai`
- `/api/logs`
- `/api/contacts`
- `/api/keys`
- `/api/groups`
- `/api/scheduled`

### `backend/controllers/`

Request handlers for auth, WhatsApp connection/sending, AI generation, logs, contacts, groups, API keys, and scheduled campaigns.

### `backend/models/`

Mongoose schemas:

- `User`
- `Session`
- `ApiKey`
- `Contact`
- `ContactGroup`
- `Campaign`
- `ScheduledCampaign`
- `MessageLog`

### `backend/middleware/`

- `auth.js`: JWT route protection
- `validateApiKey.js`: API key validation for external send endpoint
- `validatePhoneNumber.js`: phone validation and normalization middleware

### `backend/services/`

- `clientManager.js`: creates, stores, recovers, disconnects, and health-checks WhatsApp clients
- `sender.js`: bulk send logic, campaign creation, message logging, progress callback
- `scheduler.js`: polling scheduler for due scheduled campaigns
- `websocket.js`: token-authenticated WebSocket server and per-user push messages

### `backend/utils/`

- `verifyToken.js`: JWT verification for WebSocket auth
- `phone.js`: phone parsing and normalization using `libphonenumber-js`

### `frontend/`

Main frontend application using Next.js app router.

- Entry layout: `frontend/app/layout.js`
- Public page: `frontend/app/page.jsx`
- Dashboard pages: `frontend/app/dashboard/`

### `frontend/app/`

- `page.jsx`: public landing page
- `login/page.jsx`: local login plus Google OAuth link
- `signup/page.jsx`: signup plus Google OAuth link
- `auth/callback/page.jsx`: receives OAuth JWT token from backend
- `dashboard/page.jsx`: main send dashboard
- `dashboard/groups/page.jsx`: grouped contact directory
- `dashboard/history/page.jsx`: message logs and campaigns
- `dashboard/api-keys/page.jsx`: API key management
- `dashboard/scheduled/page.jsx`: scheduled campaign UI

### `frontend/context/`

- `AuthContext.jsx`: global auth state, login/signup/logout, current-user fetch

### `frontend/lib/`

- `api.js`: central Axios client and API wrappers
- `auth.js`: cookie token helpers
- `phone.js`: frontend phone normalization/formatting utilities

### `frontend/hooks/`

- `useWebSocket.js`: authenticated WebSocket connection with reconnect logic

### `frontend/components/`

- `InternationalPhoneInput.jsx`: reusable phone input wrapper

### Root Files

- `DEPLOYMENT.md`: Vercel/Render deployment notes
- `whatsapp-saas-platform.html`: standalone static HTML artifact
- `index.js`, `sender.js`: older/standalone WhatsApp sender scripts
- `api-key-send-sample.js`: sample script for API-key based send
- `run-frontend.cmd`: Windows command to start built frontend

## Tech Stack

### Frontend

- Next.js `16.2.6`
- React `19.2.4`
- Tailwind CSS v4/PostCSS
- Axios
- `js-cookie`
- `react-hot-toast`
- `lucide-react`
- `react-international-phone`
- `libphonenumber-js`

### Backend

- Node.js
- Express `5.2.1`
- MongoDB/Mongoose
- JWT via `jsonwebtoken`
- Password hashing via `bcryptjs`
- Google OAuth via `passport-google-oauth20`
- WebSocket via `ws`
- WhatsApp via `whatsapp-web.js`
- QR generation via `qrcode`
- AI via OpenRouter using Axios
- Rate limiting via `express-rate-limit`

### Package Manager

- npm
- `package-lock.json` exists in both `backend/` and `frontend/`
- No root `package.json` found

## Environment Variables

### Backend

- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`
- `CLIENT_URL`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `OPENROUTER_API_KEY`
- `MODEL_NAME`
- `BACKEND_URL`
- `CALLBACK_URL`
- `WWEBJS_AUTH_PATH`
- `PUPPETEER_EXECUTABLE_PATH`
- `CHROME_PATH`
- `EDGE_PATH`

### Frontend

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

## Main Entry Points

- Backend HTTP/API/WebSocket entry: `backend/index.js`
- Frontend root layout: `frontend/app/layout.js`
- Frontend landing page: `frontend/app/page.jsx`
- Main app dashboard: `frontend/app/dashboard/page.jsx`
- Auth provider: `frontend/context/AuthContext.jsx`
- API client layer: `frontend/lib/api.js`

## Data Flow

### Login

1. User logs in or signs up from frontend.
2. Frontend calls `/api/auth/login` or `/api/auth/signup`.
3. Backend validates credentials and signs a JWT.
4. Frontend stores JWT in a browser cookie named `token`.
5. Axios interceptor attaches `Authorization: Bearer <token>` to API requests.
6. Protected backend routes resolve `req.user` through `middleware/auth.js`.

### Google OAuth

1. Frontend links to `${NEXT_PUBLIC_API_URL}/api/auth/google`.
2. Backend starts Passport Google OAuth.
3. Callback creates or links a user.
4. Backend redirects to `${CLIENT_URL}/auth/callback?token=...`.
5. Frontend callback stores token and redirects to `/dashboard`.

### WhatsApp Connect

1. Dashboard calls `/api/whatsapp/connect`.
2. Backend creates a `whatsapp-web.js` client through `clientManager.createClient()`.
3. QR events are converted to data URLs and pushed over WebSocket.
4. Frontend receives `{ type: 'qr' }` and displays the QR.
5. On ready, backend updates `Session` and pushes `{ type: 'ready' }`.
6. Frontend marks WhatsApp as connected.

### Bulk Send

1. Dashboard sends `{ numbers, message }` to `/api/whatsapp/send`.
2. Backend checks the in-memory WhatsApp client.
3. Backend responds immediately with `Sending started`.
4. Background send runs through `services/sender.js`.
5. A `Campaign` document is created.
6. Each message creates a `MessageLog`.
7. Progress is pushed over WebSocket.
8. Campaign status is updated to `completed`.

### API Key Send

1. External caller posts to `/api/whatsapp/send-via-api` with `x-api-key`.
2. `validateApiKey` checks active key and monthly usage limit.
3. Backend sends through the owner user's connected WhatsApp client.
4. API key usage is incremented after sending.

### Scheduled Campaigns

1. Frontend creates scheduled campaign through `/api/scheduled`.
2. Backend stores `ScheduledCampaign`.
3. `services/scheduler.js` polls every 60 seconds.
4. Due pending campaigns become running.
5. Scheduler uses the user's current WhatsApp client and `sendMessages()`.
6. Scheduled campaign counters/status are updated.

### AI Generation

1. Frontend posts prompt/options to `/api/ai/generate`.
2. Backend builds system/user prompts.
3. Backend calls OpenRouter using `OPENROUTER_API_KEY` and `MODEL_NAME`.
4. For Gujarati/Hindi, backend verifies script and retries once if needed.

## Major Features

- Landing page
- Local signup/login
- Optional Google OAuth
- JWT-authenticated dashboard
- WhatsApp QR connection
- WhatsApp session recovery on backend startup
- WebSocket realtime QR/status/progress updates
- Bulk WhatsApp message sending
- CSV phone number import
- Saved contacts
- Contact groups with colors/tags
- AI message generation/refinement/translation/shortening
- Message logs
- Campaign history
- CSV export of logs
- API key generation, reveal, stats, soft delete
- API-key based external send endpoint
- Scheduled campaigns
- Scheduled campaign cancel/delete
- Basic monthly usage limit for API keys

## Reusable Layers

### Frontend

- `frontend/lib/api.js`: all API wrapper objects
- `frontend/lib/auth.js`: token cookie helpers
- `frontend/lib/phone.js`: phone normalization and formatting
- `frontend/context/AuthContext.jsx`: auth state and actions
- `frontend/hooks/useWebSocket.js`: WebSocket lifecycle
- `frontend/components/InternationalPhoneInput.jsx`: reusable phone input

### Backend

- `backend/middleware/auth.js`: JWT protection
- `backend/middleware/validateApiKey.js`: external API key auth
- `backend/middleware/validatePhoneNumber.js`: phone field normalization
- `backend/utils/phone.js`: backend phone normalization
- `backend/services/clientManager.js`: WhatsApp client/session lifecycle
- `backend/services/sender.js`: sending and logging engine
- `backend/services/websocket.js`: realtime event push
- `backend/services/scheduler.js`: scheduled campaign execution

## Coding Patterns

- Backend uses CommonJS: `require`, `module.exports`.
- Frontend uses ES modules and Next app router.
- Frontend client pages use `'use client'`.
- API calls are centralized in `frontend/lib/api.js`.
- Auth is cookie-based on frontend and JWT-header based on backend.
- Phone normalization exists in both frontend and backend.
- Backend controllers generally use `try/catch` and return JSON errors.
- Frontend pages commonly guard auth with `useEffect(() => router.push('/login'))`.
- UI style is dark theme with WhatsApp green `#25D366`.
- Most frontend state is local React state, with no external state manager.

## Risk Areas

- API keys are stored in plaintext in MongoDB. Safer design would hash keys and only reveal once.
- `api-key-send-sample.js` contains a real-looking API key and phone number. Treat as exposed.
- JWT is stored in a JavaScript-readable cookie without `httpOnly`, `secure`, or `sameSite` controls.
- Google OAuth callback passes JWT in URL query string, which can leak through browser history/logs.
- WebSocket client map stores only one socket per user, so multiple tabs/devices can overwrite each other.
- Several backend files contain mojibake/encoding corruption in comments/logs.
- `clientManager.js` force-kills browser processes and removes session directories in some recovery cases. Be careful when editing this file.
- `disconnectClient()` preserves LocalAuth session, so app logout may not fully log out WhatsApp from disk.
- Scheduled sending calls `sendMessages()`, which creates a normal `Campaign` record as a side effect in addition to `ScheduledCampaign`.
- Phone duplicate checks sometimes compare E.164 strings against digit-only strings, which can make duplicate detection inconsistent.
- AI preset/options are duplicated between dashboard and scheduled page.
- Some validation is duplicated between frontend and backend.
- No test suite is apparent.
- `CLIENT_URL` must match the frontend origin or CORS/auth redirects will break.
- WhatsApp Web automation depends on a working Chrome/Edge/Puppeteer setup and persistent auth storage.

## Local Run

### Backend

```powershell
cd backend
npm install
npm run dev
```

Backend env should include at least:

```env
MONGODB_URI=...
JWT_SECRET=...
JWT_EXPIRES_IN=30d
CLIENT_URL=http://localhost:3000
PORT=5000
OPENROUTER_API_KEY=...
MODEL_NAME=...
CLIENT_ID=...
CLIENT_SECRET=...
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend env:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000
```

Open:

```text
http://localhost:3000
```

For WhatsApp sending, MongoDB must be reachable, backend must be running, frontend must be logged in, and the user must scan the WhatsApp QR successfully.

## Mental Model

The frontend is a dashboard shell that talks to a single Express backend. The backend owns durable data in MongoDB and volatile WhatsApp browser clients in memory. MongoDB remembers users, contacts, logs, campaigns, API keys, and whether a WhatsApp session was active. The actual WhatsApp login state lives on disk through `LocalAuth`. WebSocket carries events that do not fit request/response: QR codes, connection status, and send progress. The most delicate part of the system is the boundary between MongoDB session metadata, local browser auth files, and the in-memory `clients` map.
