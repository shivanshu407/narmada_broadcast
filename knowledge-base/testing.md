# Testing

## Test Frameworks in Use
| Layer | Framework | Notes |
|-------|-----------|-------|
| Backend regression | Node.js built-in `node:test` + `node:assert/strict` | Configured through `backend/package.json` as `npm test`; tests live under `backend/test/`. Current coverage focuses on deployment/auth/chatbot/API contracts plus helper behavior. |
| Frontend lint | ESLint flat config | Configured in `frontend/eslint.config.js`; runs against `src/**/*.js` and `src/**/*.jsx`. |
| Frontend build | Vite 8 | Production compile gate for the Preact SPA. |
| Dependency audit | npm audit | Run in both `frontend/` and `backend/` with `--audit-level=high`. |

## How to Run Checks
| Command | What it runs |
|---------|--------------|
| `npm test` from `backend/` | Backend regression suite in `backend/test/*.test.js` |
| `node --check <file>` | Syntax check for one backend ES module file |
| `Get-ChildItem -Path backend/src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }` | PowerShell-friendly backend syntax sweep |
| `npm run lint` from `frontend/` | ESLint over `src/**/*.js` and `src/**/*.jsx` |
| `npm run build` from `frontend/` | Vite production build for the Preact SPA |
| `npm audit --audit-level=high` from `frontend/` | Frontend dependency vulnerability gate |
| `npm audit --audit-level=high` from `backend/` | Backend dependency vulnerability gate |
| `$env:VITE_DEV_API_PROXY_TARGET='https://broadcast-gilt.vercel.app'; npm run dev -- --host 127.0.0.1` from `frontend/` | Local Vite app pointed at the live Vercel API for browser QA without CORS issues |

## Current Session Status

As of 2026-07-02:

- PASS - `cd backend && npm test` (28 tests).
- PASS - backend PowerShell `node --check` sweep across `backend/src/**/*.js`.
- PASS - `cd frontend && npm run lint` with 10 warnings and 0 errors.
- PASS - `cd frontend && npm run build`.
- PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`.
- PASS - `git diff --check`.

## Test File Conventions
Backend regression tests live in `backend/test/*.test.js` and should use the built-in Node test runner unless a broader integration framework is deliberately introduced and logged in `decisions.md`.

Frontend automated component tests are not configured yet. Until they exist, keep frontend behavior covered by deterministic lint/build checks and add backend/static regression tests for cross-stack contract bugs when possible.

## Browser QA Checklist
- Test the authenticated app shell at desktop width and at a 390px phone viewport.
- Verify Overview is the default authenticated landing view.
- Verify tenant admins do not see the Admin Panel navigation item.
- Verify the mobile drawer opens, exposes all primary nav items, closes after navigation, and does not create horizontal overflow.
- Verify Orders uses `.orders-mobile-list` on phone widths and hides the desktop table.
- Verify Chat Inbox supports list, detail, and back navigation on phone widths.
- Verify Settings does not populate password/secret/token/key fields with stored secret values.
- Do not send messages, submit settings, delete records, or upload files during QA unless the user explicitly authorizes those side effects.

## What Must Be Tested
- Auth and tenant isolation must cover allowed and denied tenant access.
- Webhooks must cover valid and invalid signature paths before they update payments, messages, or orders.
- WhatsApp chat behavior must cover inbound message storage, realtime event refresh, 24-hour window enforcement, template sends, and bot auto-replies.
- Chat Inbox handoff behavior must cover server-side `needs_human=1` filtering, Resolve Handoff clearing server state, and teach-from-chat route contracts.
- Chat Inbox handoff UI must cover that handoff conversations expose only one feedback-sending resolve action.
- Chat Inbox UI/date behavior must cover compact header class contracts and Mongo ISO timestamps not rendering as `Invalid Date`.
- Chat Inbox commerce filters must cover server-side `filter=paid|unpaid_orders|abandoned_carts`, `filter_counts`, and paid/unpaid/abandoned conversation chips.
- Chat Inbox must keep a Vercel-safe polling fallback that refreshes the
  conversation list and selected thread without relying only on Socket.IO.
- Support feedback button replies (`feedback_good` and `feedback_bad`) must be
  acknowledged as terminal webhook events and must not enter Smart Automation.
- WhatsApp customer self-service actions must stay tenant-scoped and phone-scoped when acting on orders; cancel-order payloads must never update an order using only `tenant_id` and `id`.
- WhatsApp support contact cards must use a configured tenant phone number; do not send placeholder or sample phone numbers to customers.
- Smart Automation must not hand off no-order customers before trying FAQ/product retrieval.
- Smart Automation unmatched-message fallback must ask the customer before
  creating a human handoff, and only a Yes response should set `needs_human`.
- Broadcast targeting must cover all recipient types, including tags, labels, and custom selections.
- Settings must cover secret masking so tokens and payment secrets are not rehydrated into browser form state after reload.

## Mocks, Fakes, and Fixtures
No shared runtime mocks or fixtures exist yet. Current regression tests use source inspection and pure helper tests so they do not require MongoDB Atlas, Meta, Razorpay, Shopify, Vercel, SMTP, or Socket.io.

External services that need fakes once integration tests are added: MongoDB, Meta Graph API, Razorpay, Shopify, SMTP, Socket.io, and Vercel routing.

## Known Flaky Tests
None - keep it that way.
