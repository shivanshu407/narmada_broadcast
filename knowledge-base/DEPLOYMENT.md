# Deployment Guide

## Current Deployment Shape

Narmada Broadcast is a single-client product deployed from
`MBKANERIYA/narmada_broadcast` to Vercel.

```
Browser
  |
  | same-origin /api/v1/*
  v
Vercel frontend service (frontend/)
  |
  | /api/* route
  v
Vercel Node service (backend/src/app.js)
  |
  v
MongoDB Atlas database for this client only
```

## Vercel Project Settings

The repository uses `vercel.json` with two services:

| Service | Root | Runtime | Route |
|---------|------|---------|-------|
| Frontend | `frontend` | Vite static build | `/` |
| Backend | `backend` | `@vercel/node` | `/api/*` |

The frontend intentionally uses relative API URLs, so production requests go to
the same Vercel domain, for example `/api/v1/auth/login`.

## Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables for Production,
Preview, and Development as needed:

```bash
MONGO_URI=<mongodb-connection-string>
JWT_SECRET=<strong-random-jwt-secret>
CORS_ORIGINS=https://broadcast-gilt.vercel.app
APP_DOMAIN=broadcast-gilt.vercel.app
```

Optional integration variables are configured in the app UI where possible:
WhatsApp access token, phone number ID, business account ID, catalog ID,
Razorpay keys, Shopify credentials, and profile branding.

## MongoDB Atlas Setup

1. Create a separate MongoDB Atlas project or cluster for this client.
2. Create a database user for this app only.
3. Use a strong password and give the user access only to this client database.
4. In Network Access, allow Vercel to connect. For a quick Vercel deployment,
   Atlas often needs `0.0.0.0/0`; if using a stricter setup, use a private
   networking approach supported by the hosting plan.
5. Copy the driver connection string and include a database name, for example:

```bash
MONGO_URI=<mongodb-connection-string>
```

Do not commit the MongoDB URI. It must live only in Vercel environment
variables or local `.env` files that are ignored by git.

## Critical MongoDB Credential Note

Older fork code contained a hardcoded Atlas fallback URI. Treat those exposed
credentials as compromised:

1. Rotate or delete the exposed Atlas database user.
2. Create a fresh client-only database user.
3. Put the new URI in Vercel as `MONGO_URI`.
4. Redeploy the Vercel project.

The current code fails fast in production/Vercel if `MONGO_URI` is missing.

## Current Live URL

The active Vercel deployment is:

```bash
https://broadcast-gilt.vercel.app/
```

The previous deployment URL, `https://narmada-broadcast-8vox.vercel.app/`, was
retired after the earlier Vercel account hit deployment limits. GitHub remains
`https://github.com/MBKANERIYA/narmada_broadcast`.

## Deploy From GitHub

Vercel should be connected to:

```bash
https://github.com/MBKANERIYA/narmada_broadcast
```

Normal deployment flow:

```bash
git push origin main
```

Vercel will install and build the frontend from `frontend/package-lock.json` and
run the backend with the Node function entrypoint from `backend/src/app.js`.

## Local Verification Before Push

Run these from the repository root:

```bash
cd backend
npm test

cd ../frontend
npm run lint
npm run build
```

The frontend lint currently allows warnings, but build and backend tests must
exit successfully before deployment handoff.

## Production Smoke Checks

After Vercel redeploys:

```bash
curl https://broadcast-gilt.vercel.app/health
curl https://broadcast-gilt.vercel.app/api/v1/tenant-settings
```

For authenticated checks, log in with the client admin credentials and verify:

- Settings -> Automation & Hours loads without 404s.
- Knowledge Base list loads and newly added FAQs persist.
- Test Your Bot returns a match for a saved FAQ.
- WhatsApp settings can be saved for this client.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Backend logs say `MONGO_URI is required` | Vercel env var missing | Add `MONGO_URI=<mongodb-connection-string>` and redeploy |
| Login works but Settings/KB 500 | Mongo user or network access wrong | Check Atlas user password, database permissions, and network access |
| Bot test returns no match | No FAQs/products or no text overlap | Add FAQs/products and use Re-embed if local vectors are missing |
| Embedding re-embed returns 400 | Unknown model key | Select one of the listed local models and retry |
| Browser opens dashboard from old state | Stale local storage | Current app validates `/auth/me`; clear site data if testing old bundles |

## What Not To Do

- Do not point this client deployment at the original SaaS database.
- Do not commit MongoDB, JWT, WhatsApp, Razorpay, Shopify, or SMTP secrets.
- Do not reintroduce tenant-seat SaaS assumptions into this fork unless the
  client requirement changes.
- Do not set `VITE_API_URL` for production unless the backend is intentionally
  moved to a different origin.
