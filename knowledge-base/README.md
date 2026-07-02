# Narmada Broadcast
> Single-client WhatsApp broadcast, catalogue, chat inbox, and smart FAQ product deployed independently on Vercel.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | JavaScript |
| Frontend | Preact + Vite + Zustand |
| Backend/API | Express.js on Vercel Node functions |
| Database | MongoDB Atlas via Mongoose |
| Hosting | Vercel |
| Auth | Single-client JWT admin login |
| WhatsApp API | Meta Cloud API |
| Smart Automation | Local MiniLM/E5 embeddings with lexical fallback; no external provider key |
| Test Runner | Node built-in `node:test`, ESLint, Vite build |

## Directory Structure

```
narmada_broadcast/
├── backend/
│   ├── src/app.js                  # Express app and route mounting
│   ├── src/database.js             # Mongoose connection and MONGO_URI resolver
│   ├── src/models/                 # MongoDB/Mongoose models
│   ├── src/routes/                 # API route handlers
│   ├── src/services/               # WhatsApp, smart bot, jobs, sync services
│   └── test/regression.test.js     # Static/helper regression contracts
├── frontend/
│   ├── src/App.jsx                 # App shell and auth session validation
│   ├── src/stores/store.js         # Zustand state and API helpers
│   ├── src/components/             # Workspace screens
│   └── vite.config.js              # Vite build/dev proxy config
├── knowledge-base/                 # Project memory and handoff docs
└── vercel.json                     # Vercel frontend/backend routing
```

## Critical Rules

- This repo is a dedicated single-client product, not a tenant seat on the main SaaS.
- Production MongoDB must come from `MONGO_URI`; never commit a MongoDB URI.
- The old hardcoded Atlas fallback has been removed. Rotate any previously exposed Atlas user.
- Vercel serves frontend and backend from the same domain; production frontend uses relative `/api/v1/*` calls.
- Do not reintroduce self-service signup, pricing, or multi-tenant plan gates unless the business requirement changes.
- Keep `frontend/package-lock.json` and `backend/package-lock.json` in sync with their package files; Vercel deploys from the lockfiles.
- Run backend tests, frontend lint/build, and audits before deployment handoff.

## Quick Facts

| Key | Value |
|-----|-------|
| Repo | `https://github.com/MBKANERIYA/narmada_broadcast` |
| Vercel URL | `https://narmada-broadcast-8vox.vercel.app/` |
| DB | Client-owned MongoDB Atlas database via `MONGO_URI` |
| CI/CD | Vercel GitHub deployment from `main` |
| Backend Test Command | `cd backend && npm test` |
| Frontend Checks | `cd frontend && npm run lint && npm run build` |
| Audit Commands | `npm audit --audit-level=high` in both `backend/` and `frontend/` |

## Reading Order

| File | When to Read |
|------|--------------|
| `README.md` | Always first |
| `active-context.md` | Every session, to pick up current status |
| `DEPLOYMENT.md` | Before changing Vercel, env vars, MongoDB, or deployment flow |
| `ARCHITECTURE.md` | Before touching system boundaries or data flow |
| `decisions.md` | Before changing architecture, auth, database, deployment, or testing choices |
| `known-issues.md` | Before debugging anything |
| `testing.md` | Before writing or changing tests |
| `chat-inbox.md` | Before touching Chat Inbox, handoff, bot pause, media, or teach-from-chat |
| `chatbot.md` | Before touching Smart FAQs, Smart Automation, embeddings, or bot replies |
| `frontend.md` | Before touching the app shell or UI components |
| `security.md` | Before touching auth, secrets, webhooks, uploads, or payment flows |
| `changelog.md` | When tracing history or preparing a handoff |
