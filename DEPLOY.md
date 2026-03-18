# Free Web Hosting

This app can be hosted for free on the web as a demo.

## Important limitation

The current backend stores data in these local paths:

- backend/data/store.json
- backend/uploads/

On most free web hosts, local disk is ephemeral or reset on redeploy. That means:

- uploaded files can disappear
- app data can reset
- this is acceptable for a demo, not for durable production use

## Easiest free setup

### Frontend

Host the Vite frontend on one of these:

- Cloudflare Pages
- Netlify
- Vercel
- GitHub Pages

Build settings:

- Root directory: frontend
- Build command: npm run build
- Output directory: dist

Required environment variable:

- VITE_API_BASE=https://YOUR-BACKEND-URL/api

### Backend

Host the Node backend on one of these:

- Render
- Railway
- Koyeb
- Northflank

Backend settings:

- Root directory: backend
- Build command: npm install && npm run build
- Start command: npm run start
- Port: use the platform PORT environment variable

The backend already supports PORT and serves uploads from /uploads.

## Recommended demo deployment flow

1. Push this repo to GitHub.
2. Deploy backend first.
3. Copy the backend public URL.
4. Deploy frontend with VITE_API_BASE pointing to that backend URL plus /api.
5. Open the frontend URL and test the health-driven API flow.

Example:

- Backend URL: https://my-coc-backend.onrender.com
- Frontend env: VITE_API_BASE=https://my-coc-backend.onrender.com/api

## What I already changed in code

The frontend API base is no longer hardcoded to localhost. It now reads:

- VITE_API_BASE

with a local fallback of:

- http://localhost:4000/api

## If you want durable free hosting

You should replace local file persistence with managed services:

- database: Supabase Postgres or Neon Postgres
- file storage: Supabase Storage or Cloudflare R2

A solid free-stack target would be:

- frontend: Cloudflare Pages or Vercel
- backend: Render or Railway
- database: Supabase
- file storage: Supabase Storage

## Quick smoke test after deploy

- Frontend loads without localhost errors
- GET /api/health works on the backend
- standards list loads
- uploads and saved data work for the current session

## Best next step

If you want, I can do the next deployment step for you by preparing this repo for one specific host:

1. Render + Vercel
2. Render only
3. Netlify + Railway
4. Cloudflare Pages + Render
