# CoC Standards Workspace

End-to-end local web application for hospital CoC accreditation tracking with auditor-visible outputs.

## Scope (explicit)

- This implementation is fully local and standalone.
- No EMR integrations are included.
- No external oncology platform integrations are included.
- All data entry, evidence upload, metric updates, assignments, and review workflows are handled inside this application.

## What is implemented

- Backend API (Node + TypeScript + Express)
  - Full seeded standards coverage across sections 1.x through 9.x
  - Standard detail with numerator components and denominator rules
  - Compliance calculation and threshold checks
  - Status flow: `in-progress`, `ready-for-admin`, `locked`
  - Admin-only locking and auditor read-only enforcement
  - Evidence file upload and local file serving
  - Assignment creation and status tracking per standard
  - Auditor export endpoint with compliance, evidence, and audit logs
  - Local JSON persistence for state, uploads metadata, assignments, and logs
- Frontend (React + TypeScript + Vite)
  - OncoLens-inspired color palette and layout
  - Standards dashboard with compliance, task count, and upload count
  - Detailed standard workspace for checklist, denominator edits, and status updates
  - Evidence upload panel with open-file links
  - Assignment panel with due dates and completion toggles
  - Auditor-facing log panel showing immutable activity history

## Project layout

- `backend/` API service
- `backend/data/store.json` persisted local application data
- `backend/uploads/` uploaded evidence files
- `frontend/` web app
- `Optimal_Resources_for_Cancer_Care.pdf` source standards reference

## Local run

### 1) Start backend

```powershell
cd backend
npm install
npm run dev
```

Backend URL: `http://localhost:4000`

Health check:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

### 2) Start frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## API endpoints

- `GET /api/health`
- `GET /api/hospitals`
- `GET /api/hospitals/:hospitalId/standards`
- `GET /api/hospitals/:hospitalId/standards/:standardCode`
- `POST /api/hospitals/:hospitalId/standards/:standardCode/metrics`
- `POST /api/hospitals/:hospitalId/standards/:standardCode/status`
- `GET /api/hospitals/:hospitalId/standards/:standardCode/uploads`
- `POST /api/hospitals/:hospitalId/standards/:standardCode/uploads`
- `GET /api/hospitals/:hospitalId/standards/:standardCode/assignments`
- `POST /api/hospitals/:hospitalId/standards/:standardCode/assignments`
- `PATCH /api/hospitals/:hospitalId/standards/:standardCode/assignments/:assignmentId`
- `GET /api/hospitals/:hospitalId/audit-logs`
- `GET /api/hospitals/:hospitalId/auditor-export`

## Local data behavior

- Data persists to `backend/data/store.json`.
- Uploaded files are stored in `backend/uploads`.
- Restarting the backend keeps previous local data unless you delete the store file and uploads folder.


## Web hosting

See DEPLOY.md for free-hosting options and the current persistence limitation around local JSON and uploads.



## Render + Vercel

This repo now includes Render and Vercel deployment config. See DEPLOY.md for the exact setup.

