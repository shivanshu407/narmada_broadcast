# Narmada Broadcast

Single-client WhatsApp broadcast, catalogue, orders, chat inbox, and smart FAQ
workspace deployed independently on Vercel.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Preact + Vite + Zustand |
| Backend | Express.js on Vercel Node functions |
| Database | MongoDB Atlas via Mongoose |
| WhatsApp | Meta Cloud API |
| Smart Automation | Local embeddings with lexical fallback; no external provider key |
| Deployment | Vercel from `MBKANERIYA/narmada_broadcast` |

## Local Setup

```bash
cd backend
npm install

cd ../frontend
npm install
```

Create `backend/.env` for local development:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=<mongodb-connection-string>
JWT_SECRET=<strong-random-jwt-secret>
```

Run locally:

```bash
cd backend
npm run dev

cd ../frontend
npm run dev
```

The frontend dev server proxies `/api/*` to `http://localhost:3000` by default.

## Verification

```bash
cd backend
npm test
npm audit --audit-level=high

cd ../frontend
npm run lint
npm run build
npm audit --audit-level=high
```

## Vercel Environment

Set these in Vercel before deploying:

```env
MONGO_URI=<mongodb-connection-string>
JWT_SECRET=<strong-random-jwt-secret>
CORS_ORIGINS=https://broadcast-gilt.vercel.app
APP_DOMAIN=broadcast-gilt.vercel.app
```

Important: do not commit real MongoDB, JWT, Meta, Razorpay, or Shopify secrets.

## Documentation

Read `knowledge-base/README.md` first, then `knowledge-base/DEPLOYMENT.md` for
the Vercel/MongoDB setup and `knowledge-base/chatbot.md` for Smart FAQ behavior.
