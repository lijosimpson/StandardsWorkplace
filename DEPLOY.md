# Vercel + Supabase Deployment

This repo is being prepared to run on free Vercel plus free Supabase:

- frontend project rooted at frontend
- backend project rooted at backend
- Supabase project files rooted at supabase

## Current backend persistence behavior

The backend now supports two persistence modes:

- Supabase-backed app state through the `app_state` table when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured
- local file fallback when those variables are not configured

Current limitation:

- uploaded files are still local-path based and have not been moved to Supabase Storage yet
- on Vercel, local uploads remain temporary until the upload migration is finished

## Frontend on Vercel

Use the frontend folder as one Vercel project.

Settings:

- Root Directory: frontend
- Build Command: npm run build
- Output Directory: dist
- Environment Variable: VITE_API_BASE=https://YOUR-BACKEND-VERCEL-URL/api

## Backend on Vercel

Use the backend folder as a second Vercel project.

Settings:

- Root Directory: backend
- Framework preset: Other
- Build Command: npm run build

Environment variables:

- CORS_ORIGIN=https://YOUR-FRONTEND-VERCEL-URL
- SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
- SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
- SUPABASE_STORAGE_BUCKET_EVIDENCE=evidence-uploads
- SUPABASE_STORAGE_BUCKET_PROCESS=process-documents
- SUPABASE_STORAGE_BUCKET_QUARTERLY=quarterly-evidence
- SUPABASE_STORAGE_BUCKET_QUALITY=quality-reference-docs

## Supabase setup

Repo files:

- supabase/config.toml
- supabase/seed.sql
- supabase/migrations/20260318_0001_initial_schema.sql
- supabase/migrations/20260318_0002_storage_buckets.sql

Local CLI workflow:

```powershell
supabase start
supabase db reset
supabase status
```

Hosted project setup:

1. Create a free Supabase project.
2. Run the SQL from the migrations in order, or use the Supabase CLI to push them.
3. Confirm the `app_state` table exists.
4. Confirm the storage buckets exist.
5. Copy `SUPABASE_URL` and the service-role key into the backend Vercel project.

## Deploy order

1. Provision Supabase and apply the schema.
2. Deploy backend Vercel project with the Supabase environment variables.
3. Verify https://YOUR-BACKEND-VERCEL-URL/api/health.
4. Deploy frontend Vercel project with `VITE_API_BASE` pointing to the backend URL plus `/api`.
5. Set backend `CORS_ORIGIN` to the frontend URL.

## Auto GitHub uploads

This repo includes a local post-commit hook in `.githooks/post-commit`.

Each new local commit is pushed to `origin` automatically.
