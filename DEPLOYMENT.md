# Deployment Guide

This app is split into two deployable parts:

- Frontend: `frontend/` on Vercel
- Backend: `backend/` on Render

## 1) Deploy the frontend to Vercel

1. Import the repository into Vercel.
2. Set the project root directory to `frontend`.
3. Keep the build command as `npm run build`.
4. Set the output to the default Next.js app output.
5. Add these environment variables in Vercel:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL, for example `https://your-backend.onrender.com`
   - `NEXT_PUBLIC_WS_URL` = your backend WebSocket URL, for example `wss://your-backend.onrender.com`

## 2) Deploy the backend to Render

1. Create a new Render Web Service from the same repository.
2. Set the root directory to `backend`.
3. Set the build command to `npm install`.
4. Set the start command to `npm start`.
5. Add these environment variables in Render:
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `JWT_SECRET` = a long random secret
   - `JWT_EXPIRES_IN` = for example `30d`
   - `CLIENT_URL` = your Vercel frontend URL, for example `https://your-frontend.vercel.app`
   - `CLIENT_ID` = Google OAuth client id, if you use Google login
   - `CLIENT_SECRET` = Google OAuth client secret, if you use Google login
   - `OPENROUTER_API_KEY` = required only if you use the AI route
   - `WWEBJS_AUTH_PATH` = mounted disk path for WhatsApp session data, for example `/var/data/wwebjs`

## 3) Add persistent storage on Render

MongoDB stores the session record and recovery metadata, but the WhatsApp login state itself is created by `LocalAuth` on disk. On Render, you should attach a persistent disk so that WhatsApp stays logged in after restarts.

1. Create a disk for the backend service.
2. Mount it at the same path you used for `WWEBJS_AUTH_PATH`.
3. Keep that path stable across deploys so the WhatsApp session survives restarts.

## 4) Configure Google OAuth

In Google Cloud Console, update your OAuth client with:

- Authorized redirect URI: `https://your-backend.onrender.com/api/auth/google/callback`
- Authorized JavaScript origin: `https://your-frontend.vercel.app`

## 5) Final checks

1. Redeploy the backend first.
2. Redeploy the frontend after the backend URL is available.
3. Open the frontend and confirm login, API calls, and WebSocket updates work.
4. If Google login is enabled, test the callback flow once and confirm it lands on `/auth/callback`.

## Local development mapping

- Frontend local URL: `http://localhost:3000`
- Backend local URL: `http://localhost:5000`
- Local API env: `NEXT_PUBLIC_API_URL=http://localhost:5000`
- Local WebSocket env: `NEXT_PUBLIC_WS_URL=ws://localhost:5000`
- Local backend client URL: `CLIENT_URL=http://localhost:3000`
