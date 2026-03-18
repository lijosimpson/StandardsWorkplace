# Free Web Hosting

This app can be hosted on the web as a demo using Vercel for the frontend and Render for the backend.

## Important limitation

The current backend stores data in these local paths:

- backend/data/store.json
- backend/uploads/

On most low-cost or free-style hosts, local disk is ephemeral or reset on redeploy. That means:

- uploaded files can disappear
- app data can reset
- this is acceptable for a demo, not for durable production use

## Render + Vercel

This repo is now prepared for that setup.

Files added for deployment:

- render.yaml
- backend/.env.example
- frontend/vercel.json
- frontend/.env.example

### 1. Deploy backend to Render

1. In Render, create a new Web Service from this GitHub repo.
2. Render can read render.yaml automatically.
3. If Render asks for settings, use:
   - Root Directory: backend
   - Build Command: npm install && npm run build
   - Start Command: npm run start
   - Health Check Path: /api/health
4. Set environment variable:
   - CORS_ORIGIN=https://YOUR-VERCEL-URL.vercel.app
5. Deploy and copy the backend URL.

Expected backend example:

- https://standardsworkplace-api.onrender.com

### 2. Deploy frontend to Vercel

1. Import the same GitHub repo into Vercel.
2. Set Root Directory to frontend.
3. Vercel can use frontend/vercel.json automatically.
4. Add environment variable:
   - VITE_API_BASE=https://YOUR-RENDER-URL.onrender.com/api
5. Deploy.

Expected frontend example:

- https://standards-workplace.vercel.app

### 3. Smoke test

- Open the frontend URL
- Confirm standards load
- Confirm the browser shows no localhost API calls
- Confirm backend health works at /api/health

## Automatic GitHub uploads

I also configured a local git post-commit hook path for this repo.

What it does:

- after each local git commit, git automatically runs git push origin <current-branch>

What it does not do:

- it does not auto-commit file edits
- you still need to create a commit

That is the safe boundary. Auto-committing every file save would be noisy and risky.

## Local hook activation in this repo

Run once if needed:

- git config core.hooksPath .githooks

The repo includes:

- .githooks/post-commit

## If you want durable hosting later

You said we will do this later. The right next upgrade is:

- database: Supabase Postgres or Neon
- file storage: Supabase Storage or Cloudflare R2
