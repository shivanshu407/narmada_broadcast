# Development Guide

## Local Development Setup

### Prerequisites

- Node.js 18+
- Access to a MongoDB database
- Git

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=<mongodb-connection-string>
JWT_SECRET=<strong-random-jwt-secret>
```

Start the backend:

```bash
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev proxy targets `http://localhost:3000` by default. To point local UI
at the live Vercel API:

```powershell
$env:VITE_DEV_API_PROXY_TARGET='https://broadcast-gilt.vercel.app'
npm run dev -- --host 127.0.0.1
```

## Auth Rules

- Login is single-client admin login through `POST /api/v1/auth/login`.
- Browser startup validates persisted sessions through `GET /api/v1/auth/me`.
- Frontend token storage uses `narmada_broadcast_token`; do not return to the old generic `token` key.

## Backend Patterns

- Use Mongoose models from `backend/src/models/`.
- Use `req.tenant` and `req.tenantId` from `loadSettings` for singleton client context.
- Do not add a hardcoded MongoDB URI. Production/Vercel must use `MONGO_URI`.
- Do not make FAQ/product saves depend on an external provider key; use local embeddings plus fallback behavior.
- Keep route responses aligned with frontend store/component contracts and add regression tests for any cross-stack contract.

## Frontend Patterns

- Use Preact hooks from `preact/hooks`.
- Shared API actions generally live in `frontend/src/stores/store.js`.
- Some legacy components still perform direct `fetch`; when touching them, use `narmada_broadcast_token` for auth headers.
- Keep text and controls responsive on phone widths.

## Verification Checklist

```bash
cd backend
npm test
Get-ChildItem -Recurse src -Filter *.js | ForEach-Object { node --check $_.FullName }
npm audit --audit-level=high

cd ../frontend
npm run lint
npm run build
npm audit --audit-level=high
```

## Common Gotchas

1. Vercel will fail production startup without `MONGO_URI`.
2. Settings Smart Automation calls several routes in parallel; missing one route creates noisy 404s.
3. Knowledge Base list must return `{ faqs: [...] }`.
4. Re-embed uses local model keys from `embeddingConfig.js`; it must not ask for a provider key.
5. Vercel serverless storage is ephemeral; do not assume local uploads persist forever.
6. Do not restore unmounted mailer or SaaS signup code without a real requirement and tests.
