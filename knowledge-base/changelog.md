# Changelog

## 2026-07-02 — Update Vercel Live URL
**What**: Updated deployment documentation and QA handoff references to the new live Vercel URL `https://broadcast-gilt.vercel.app/`.
**Why**: The previous Vercel account hit deployment limits, so the live project moved accounts while the GitHub repository stayed `MBKANERIYA/narmada_broadcast`.
**Impact**: Future env setup, smoke tests, Vite live-proxy QA, and deployment handoffs should use `broadcast-gilt.vercel.app`; code still uses same-origin relative API calls in production.
**Files Changed**: `README.md`, `knowledge-base/README.md`, `knowledge-base/DEPLOYMENT.md`, `knowledge-base/DEVELOPMENT_GUIDE.md`, `knowledge-base/testing.md`, `knowledge-base/frontend.md`, `knowledge-base/active-context.md`, `knowledge-base/changelog.md`
**Tests**: Docs-only change; no automated test added. Verification: URL references scanned with `rg`, and `git diff --check` run after edits.
**Commit**: Pending

- Replaced active docs and QA commands that pointed to `https://narmada-broadcast-8vox.vercel.app/`.
- Added a deployment note that the previous Vercel URL was retired due to account deployment limits.
- Kept the GitHub remote/repo references unchanged.

All notable changes to the WhatsApp Broadcast SaaS project, in reverse chronological order.

## 2026-07-02 — Fix Chat Feedback And Vercel Inbox Refresh
**What**: Made support feedback button replies terminal webhook events and added a polling fallback for Chat Inbox on Vercel.
**Why**: WhatsApp Good/Bad feedback replies were falling through into Smart Automation and producing unrelated bot answers, and Vercel serverless sockets could leave Chat Inbox stale until a manual refresh.
**Impact**: Feedback button replies now store `last_support_feedback`, send a simple thank-you, and skip bot automation. Chat Inbox refreshes conversations and the open thread every 5 seconds while mounted, and refreshes immediately on tab focus/visibility. The pre-existing labeled-broadcast static test was also updated to match the current Mongo route assignment.
**Files Changed**: `backend/src/services/supportFeedback.js`, `backend/src/routes/webhook.js`, `backend/test/regression.test.js`, `frontend/src/components/WhatsAppChat.jsx`, `knowledge-base/changelog.md`, `knowledge-base/known-issues.md`, `knowledge-base/decisions.md`, `knowledge-base/chat-inbox.md`, `knowledge-base/whatsapp-webhook.md`, `knowledge-base/frontend.md`, `knowledge-base/testing.md`, `knowledge-base/active-context.md`
**Tests**: PASS - `cd backend && npm test` (28 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (10 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: Pending

- Added `supportFeedback.js` to parse stable `feedback_good`/`feedback_bad` button IDs without treating typed "Good" as support feedback.
- Short-circuited webhook processing before Smart Automation when support feedback is received.
- Added a Vercel-safe Chat Inbox polling fallback using current refs for search, filter, and selected conversation.
- Updated regression coverage for support feedback, Vercel inbox refresh, and the current labeled-broadcast Mongo query shape.

## 2026-07-02 — Ask Before Unknown-Message Human Handoff
**What**: Changed Smart Automation's unmatched-message fallback to ask the customer before creating a human handoff.
**Why**: Random or unsupported customer messages should not immediately mark a chat as `needs_human`. The customer should choose whether they want a person to join.
**Impact**: When Smart Automation finds no FAQ, product, flow, or retrieval answer, WhatsApp sends Yes/No buttons asking whether to add a human. Yes sets `needs_human`, pauses the bot, emits `handoff_requested`, and sends the existing store-team notification. No clears the pending state and asks the customer to rephrase.
**Files Changed**: `backend/src/services/humanHandoffConfirmation.js`, `backend/src/routes/webhook.js`, `backend/test/regression.test.js`, `knowledge-base/README.md`, `knowledge-base/changelog.md`, `knowledge-base/known-issues.md`, `knowledge-base/decisions.md`, `knowledge-base/chatbot.md`, `knowledge-base/chat-inbox.md`, `knowledge-base/whatsapp-webhook.md`, `knowledge-base/testing.md`, `knowledge-base/active-context.md`
**Tests**: PASS - `cd backend && npm test` (26 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (10 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: Pending

- Added a small helper for the confirmation prompt payload and Yes/No parsing.
- Persisted pending confirmation in `conversation.bot_state.awaiting_human_confirmation`.
- Kept the existing human handoff state/event path behind a customer confirmation.
- Added regression coverage for the prompt, reply parser, pending state, and webhook wiring.

## 2026-07-02 — Fix Duplicate Chat Resolve Feedback
**What**: Removed the duplicate feedback-sending resolve path from Chat Inbox handoff conversations.
**Why**: Conversations that were both `needs_human` and `bot_paused` showed the Needs Human handoff resolve action and the generic Resolve Chat action, allowing two feedback requests to be sent to the same customer.
**Impact**: Handoff conversations now expose only the handoff resolve path for feedback. The generic Resolve Chat button remains available for bot-paused conversations that are not human handoffs. The backend also blocks stale/double support-resolve requests from sending duplicate feedback.
**Files Changed**: `frontend/src/components/WhatsAppChat.jsx`, `backend/src/routes/whatsapp-chat.js`, `backend/test/regression.test.js`, `knowledge-base/changelog.md`, `knowledge-base/known-issues.md`, `knowledge-base/decisions.md`, `knowledge-base/chat-inbox.md`, `knowledge-base/testing.md`, `knowledge-base/active-context.md`
**Tests**: PASS - `cd backend && npm test` (25 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (10 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: Pending

- Hid the generic Resolve Chat support action while `needs_human` is active.
- Added a bot-pause route guard that tells stale clients to use Resolve Handoff for handoff conversations.
- Made feedback sending idempotent for support resolve by requiring the conversation to have been paused before the request.
- Added regression coverage for the single feedback-sending resolve action.

## 2026-07-02 — Port Chat Inbox Commerce Filters
**What**: Ported main-platform commit `3f088251462d3ae1210bfcfe3d13f0bb612cab7d` into the Mongo/Vercel Narmada fork.
**Why**: The main platform added Chat Inbox filters for paid orders, unpaid hosted-checkout orders, and abandoned carts; Narmada still had the older tab UI and only a legacy paid-order filter.
**Impact**: Chat Inbox now uses a compact filter dropdown, shows server-provided counts, marks conversations with Paid/Unpaid/Abandoned cart chips, and filters against Mongo `Order` state while staying compatible with older single-client order documents.
**Files Changed**: `backend/src/models/Order.js`, `backend/src/routes/whatsapp-chat.js`, `backend/test/regression.test.js`, `frontend/src/components/WhatsAppChat.jsx`, `frontend/src/stores/store.js`, `frontend/src/styles/main.css`, `knowledge-base/README.md`, `knowledge-base/changelog.md`, `knowledge-base/known-issues.md`, `knowledge-base/decisions.md`, `knowledge-base/chat-inbox.md`, `knowledge-base/frontend.md`, `knowledge-base/hosted-checkout.md`, `knowledge-base/testing.md`, `knowledge-base/active-context.md`
**Tests**: PASS - `cd backend && npm test` (24 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (10 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: Pending

- Added Mongo order phone-set filters for `paid`, `unpaid_orders`, and `abandoned_carts`.
- Added `filter_counts` and per-conversation commerce flags to the Chat Inbox conversations API.
- Replaced the Chat Inbox tab grid with the compact dropdown used by the main platform.
- Added regression coverage for the Mongo commerce-filter route, store, UI, and CSS contracts.

## 2026-07-02 — Port Chat Inbox Compact UI And Date Formatting
**What**: Ported the main-platform compact Chat Inbox header treatment and added Mongo-safe chat date formatting for Narmada.
**Why**: The Narmada Chat Inbox still showed the older taller header layout, and Mongo ISO timestamps rendered as `Invalid Date` because the UI parser was built for legacy SQL timestamp strings.
**Impact**: Chat Inbox has the same compact header polish as the main broadcast platform, and conversation/message timestamps now support Mongo ISO strings, legacy SQL-style UTC strings, Date objects, and invalid values without showing `Invalid Date`.
**Files Changed**: `frontend/src/components/WhatsAppChat.jsx`, `frontend/src/styles/main.css`, `frontend/src/utils/chatDates.js`, `backend/test/regression.test.js`, `knowledge-base/changelog.md`, `knowledge-base/known-issues.md`, `knowledge-base/chat-inbox.md`, `knowledge-base/frontend.md`, `knowledge-base/testing.md`, `knowledge-base/active-context.md`
**Tests**: PASS - `cd backend && npm test` (23 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (10 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: Pending

- Added shared `chatDates.js` helpers for safe Chat Inbox timestamp parsing/formatting.
- Updated `WhatsAppChat.jsx` to use the compact header classes and shared formatters.
- Added regression coverage for compact header class contracts and Mongo ISO date formatting.

## 2026-07-02 — Restore Chat Inbox Handoff Routes On Vercel
**What**: Added the missing Mongo/Vercel backend routes for Chat Inbox handoff resolution and teach-from-chat, and restored server-side Needs Human filtering.
**Why**: The live Vercel frontend called `PATCH /api/v1/whatsapp/chat/conversations/:id/handoff/resolve`, but the backend did not define that route, so Express returned an HTML `Cannot PATCH ...` page in the error toast.
**Impact**: Resolve Handoff now resumes Smart Automation for that conversation, clears `needs_human`, clears `handoff_reason`, optionally sends the customer feedback request, and refreshes the handoff queue. Teach-from-chat can create Smart FAQs through the backend route the UI already called.
**Files Changed**: `backend/src/routes/whatsapp-chat.js`, `backend/test/regression.test.js`, `knowledge-base/chat-inbox.md`, `knowledge-base/README.md`, `knowledge-base/changelog.md`, `knowledge-base/known-issues.md`, `knowledge-base/testing.md`, `knowledge-base/active-context.md`
**Tests**: PASS - `cd backend && npm test` (22 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (10 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: Pending

- Ported the main-platform `handoff/resolve` and `teach` Chat Inbox contracts to the Mongo/Vercel fork.
- Added regression coverage that fails if the frontend Chat Inbox handoff and teach actions drift away from backend routes again.
- Added a dedicated Chat Inbox KB page documenting route contracts and Vercel gotchas.

## 2026-07-02 — Smart Automation No-Order FAQ Fallback
**What**: Ported the main platform chatbot fix from `4943beeb6977d2d77c8565e4ad9eb97b87c021fc` so no-order Smart Flow handoffs are deferred behind FAQ/product retrieval.
**Why**: Order/delivery/payment-style questions can trigger the order-status flow. If the customer has no order, the app should still try the client's Smart FAQs/products before telling the customer a human will follow up.
**Impact**: High-confidence FAQ retrieval still wins before Smart Flows. Other Smart Flow replies still return immediately. Only `reason: 'order_not_found'` handoffs are stored as a fallback and returned when retrieval/legacy matching cannot answer.
**Files Changed**: `backend/src/services/smartResponder.js`, `backend/test/regression.test.js`, `knowledge-base/changelog.md`, `knowledge-base/known-issues.md`, `knowledge-base/decisions.md`, `knowledge-base/chatbot.md`, `knowledge-base/testing.md`, `knowledge-base/active-context.md`
**Tests**: PASS - `cd backend && npm test` (21 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (9 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: Pending

- Added `isDeferredFlowReply()` for `order_not_found` handoff replies.
- Added regression coverage that fails if no-order customers are handed off before FAQ/product retrieval can answer.
- Kept the single-client local Smart Automation contract; no external provider key or SaaS tenant behavior was introduced.

## 2026-07-02 — Use Writable Transformer Cache On Vercel
**What**: Configured the local Smart Automation embedding runtime to cache HuggingFace model files under a writable temp directory instead of the deployed package bundle.
**Why**: The live Vercel deployment failed when switching to the multilingual E5 model because Transformers.js tried to create its default cache under `/var/task/backend/node_modules/...`, which is read-only in Vercel functions.
**Impact**: Settings -> Automation & Hours can re-embed and switch local MiniLM/E5 models on Vercel without requiring any AI provider key; cold starts may still download model files into `/tmp`.
**Files Changed**: `backend/src/services/smartResponder.js`, `backend/test/regression.test.js`, `knowledge-base/changelog.md`, `knowledge-base/known-issues.md`, `knowledge-base/chatbot.md`, `knowledge-base/testing.md`, `knowledge-base/active-context.md`
**Tests**: PASS - `cd backend && npm test` (20 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (9 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: Pending

- Set `env.cacheDir` before any `pipeline()` load so Transformers.js writes cache files to `os.tmpdir()/narmada-transformers-cache`.
- Added a regression test that fails if Smart Automation falls back to a package-local cache path on serverless deploys.
- Documented the Vercel `/var/task` read-only cache failure and the optional `TRANSFORMERS_CACHE_DIR` override.

## 2026-07-02 — Fix: WhatsApp Template Dropdown Visibility
**What**: Modified the `SendBroadcast` template dropdown in the frontend to display all fetched templates regardless of approval status, while keeping unapproved templates (PENDING/REJECTED) visually disabled.
**Why**: Users were confused when freshly created templates did not appear in the dropdown. The frontend was previously filtering out any template that didn't strictly have an `APPROVED` status, leading users to believe the Meta API fetch was failing.
**Files Changed**: `frontend/src/components/WhatsAppBroadcast.jsx`
**Commit**: Pending

## 2026-07-02 — Fix: Postinstall Shell Interpolation Error
**What**: Modified the `postinstall` script in `backend/package.json` to use string concatenation (`+`) instead of ES6 template literals (`${}`).
**Why**: Vercel executes `npm` scripts in a POSIX shell. The shell interpreted `${p}` and `${d}` as empty shell variables, causing a syntax error in the Node.js script during the Vercel build. This fix ensures the optimization script runs correctly.
**Files Changed**: `backend/package.json`
**Commit**: Pending

## 2026-07-02 — Fix: Vercel Function Size Optimization (Hobby Plan)
**What**: Added a `postinstall` script to `backend/package.json` that automatically prunes macOS and Windows binaries from `onnxruntime-node` (`@huggingface/transformers` dependency) during deployment.
**Why**: Vercel Hobby plan has a strict 250MB limit on uncompressed Serverless Functions, which caused the deployment to fail despite the `VERCEL_SUPPORT_LARGE_FUNCTIONS` flag. Pruning unused OS binaries drops the function size significantly and allows the backend to deploy successfully within Hobby limits.
**Files Changed**: `backend/package.json`
**Commit**: Pending

## 2026-07-02 — Fix: High-Confidence FAQs Override Smart Flows
**What**: Modified the `handleSmartReply` routing logic in `smartResponder.js` to evaluate `retrieval_v2` (Semantic FAQs) before `smart_flows`. If a high-confidence FAQ match is found, it now returns immediately and bypasses the built-in smart flows.
**Why**: Customers were unable to receive replies from manually added FAQs like "where is my order?" because the generic `order_status` smart flow intercepted the phrase, attempted to look up a real database order, and returned a fallback "handoff to human" message instead of the configured FAQ answer. High-confidence specific FAQs should always win.
**Files Changed**: `backend/src/services/smartResponder.js`
**Commit**: Pending

## 2026-07-02 — Fix: Vercel Large Functions Support
**What**: Added `VERCEL_SUPPORT_LARGE_FUNCTIONS: 1` to `vercel.json` environment configurations.
**Why**: The addition of `@huggingface/transformers` to the backend increased the Serverless Function size to ~397MB, exceeding Vercel's default 250MB limit. This setting opts the deployment into Vercel's large functions beta, allowing the deployment to succeed.
**Files Changed**: `vercel.json`
**Commit**: `076c242`

## 2026-07-02 — Sync: Pulled Latest Code
**What**: Executed `git pull origin main` to fetch and accept all incoming changes from the remote repository.
**Why**: User request to sync the local codebase with the remote repository.
**Files Changed**: Multiple backend, frontend, and knowledge-base files were updated via fast-forward.
**Commit**: `7496a14`

## 2026-07-02 — Restore Local Smart Automation For Vercel Fork
**What**: Removed the external provider-key Smart Automation path from the Narmada Vercel fork, restored local embedding models with lexical fallback, renamed active UI/API surfaces to Smart Automation, and updated deployment docs so Vercel no longer asks for an AI key.
**Why**: The client deployment must be a single-client version of the main WhatsApp Broadcast platform, not a cloud-provider chatbot variant. The earlier fork repair made a Gemini key optional, but the correct product contract is no external provider key requirement.
**Impact**: Vercel env setup now requires only infrastructure secrets such as `MONGO_URI` and `JWT_SECRET`; Settings uses `/tenant-settings/smart-automation/*`; FAQ/product vectors use local MiniLM/E5 model keys when available; lexical fallback remains for missing vectors or model cold-start failures.
**Files Changed**: `README.md`, `backend/package.json`, `backend/package-lock.json`, `backend/src/routes/knowledge-base.js`, `backend/src/routes/products.js`, `backend/src/routes/tenant-settings.js`, `backend/src/services/smartResponder.js`, `backend/test/regression.test.js`, `frontend/src/components/KnowledgeBase.jsx`, `frontend/src/components/Settings.jsx`, `frontend/src/components/WhatsAppChat.jsx`, `frontend/src/config/plans.js`, `frontend/src/stores/store.js`, `knowledge-base/ARCHITECTURE.md`, `knowledge-base/DEPLOYMENT.md`, `knowledge-base/DEVELOPMENT_GUIDE.md`, `knowledge-base/README.md`, `knowledge-base/active-context.md`, `knowledge-base/chatbot.md`, `knowledge-base/decisions.md`, `knowledge-base/known-issues.md`, `knowledge-base/security.md`, `knowledge-base/testing.md`
**Tests**: PASS - `cd backend && npm test` (19 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (9 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: Pending

- Added `@huggingface/transformers` to the Mongo/Vercel fork and changed `smartResponder.generateEmbedding()` to use local feature extraction.
- Changed Knowledge Base, Product, and re-embed flows to tag vectors with local model keys from `embeddingConfig.js`.
- Renamed active frontend/store/backend routes from AI Assistant language to Smart Automation.
- Added regression coverage that fails if active source or product docs reintroduce external provider key requirements.

## 2026-07-01 - Vercel Single-Client Deployment Repair
**What**: Removed the hardcoded MongoDB fallback, restored missing Vercel API contracts for auth, chatbot, AI Assistant, embeddings, and Knowledge Base, added text-only bot fallback, refreshed deployment docs, and removed an unused vulnerable mailer dependency.
**Why**: The independent Narmada Vercel deployment was not behaving as a clean single-client product: chatbot/settings routes returned 404, Knowledge Base responses did not match the frontend contract, stale browser auth could open the dashboard without validation, and MongoDB isolation depended on an exposed fallback URI.
**Impact**: Vercel production now requires `MONGO_URI`; old persisted auth state and generic `localStorage.token` are ignored by the new frontend storage keys; FAQ/product matching works without embeddings but semantic quality improves after setting `AI_API_KEY` and re-embedding; the unused public lead mailer route/dependency is removed.
**Files Changed**: `README.md`, `backend/package.json`, `backend/package-lock.json`, `backend/src/config.js`, `backend/src/database.js`, `backend/src/routes/auth.js`, `backend/src/routes/knowledge-base.js`, `backend/src/routes/tenant-settings.js`, `backend/src/routes/leads.js`, `backend/src/services/smartResponder.js`, `backend/test/regression.test.js`, `frontend/package-lock.json`, `frontend/src/App.jsx`, `frontend/src/components/AdminPanel.jsx`, `frontend/src/components/Catalogue.jsx`, `frontend/src/components/Contacts.jsx`, `frontend/src/components/KnowledgeBase.jsx`, `frontend/src/components/Orders.jsx`, `frontend/src/components/Overview.jsx`, `frontend/src/components/Settings.jsx`, `frontend/src/stores/store.js`, `knowledge-base/README.md`, `knowledge-base/ARCHITECTURE.md`, `knowledge-base/DEPLOYMENT.md`, `knowledge-base/DEVELOPMENT_GUIDE.md`, `knowledge-base/chatbot.md`, `knowledge-base/changelog.md`, `knowledge-base/decisions.md`, `knowledge-base/known-issues.md`, `knowledge-base/security.md`, `knowledge-base/testing.md`, `knowledge-base/active-context.md`
**Tests**: PASS - `cd backend && npm test` (18 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (warnings only); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.
**Commit**: `c4bfe48`

- Added `resolveMongoUri()` and removed the hardcoded Atlas fallback; Vercel/production now fails fast without `MONGO_URI`.
- Added `/api/v1/auth/me` and frontend `validateSession()` with product-specific persisted auth and token storage.
- Added AI Assistant, embedding status/re-embed, Knowledge Base test, and alternate phrasing endpoints.
- Made FAQ/product chatbot matching resilient when `AI_API_KEY` is missing by using lexical scoring.
- Replaced stale Hostinger/MySQL deployment docs with Vercel + MongoDB Atlas instructions and credential rotation guidance.

## 2026-07-01 — UI: Remove Default Admin Credentials Hint
**What**: Removed the hardcoded admin credentials (`admin` / `admin123`) hint box from the frontend Login page.
**Why**: The hint was displaying default login credentials on the public login page, which is a security risk for a production environment.
**Files Changed**:
- `frontend/src/components/Login.jsx`: Deleted the div containing the credentials hint.

## 2026-07-01 — Feature: Pull Products from Meta Catalogue
**What**: Added a "Sync from Meta" button to the Catalogue page and fixed a typo in the Meta Catalog ID saving logic that prevented fetching and pushing.
**Why**: The user's database had a typo in the `whatsapp_catalog_id` (missing `65`) which prevented products from syncing up to Meta. Furthermore, the user wanted a way to fetch their existing 23 products from Meta into the local platform.
**Files Changed**:
- `backend/src/services/metaCatalogSync.js`: Added `item_type: 'PRODUCT_ITEM'` parameter to the `items_batch` payload. Renamed `image_url` to `image_link` and added a default `link` parameter to satisfy Meta Commerce API requirements and resolve yellow warning triangles on uploaded products.
- `backend/src/routes/products.js`: Added `POST /sync-meta` endpoint to fetch products from Meta Graph API and upsert them into the local MongoDB instance.
- `frontend/src/components/Catalogue.jsx`: Added "Sync from Meta" button.

## 2026-07-01 — Bugfix: Resolve Server Crash on Catalog Load
**What**: Fixed an `ERR_MODULE_NOT_FOUND` crash that caused the backend server to fail on startup. Removed the `node-fetch` import from `metaCatalogSync.js`.
**Why**: The backend runs on Node.js 18+ which has native `fetch` support. The `node-fetch` package was not in `package.json`, causing the entire backend process to crash. This resulted in the frontend Vite proxy returning a 504 HTML error page which failed to parse as JSON.
**Files Changed**:
- `backend/src/services/metaCatalogSync.js`: Removed `import fetch from 'node-fetch'`.

## 2026-07-01 — Feature: Meta Commerce Catalog Real-Time Sync
**What**: Developed a two-way synchronization service to automatically push products created or modified in the platform's Catalogue to the connected Meta Commerce Manager catalog.
**Why**: When administrators add products in the dashboard, they expect them to be immediately available on WhatsApp for sharing via catalogue cards. This eliminates the need for double data entry in both the SaaS dashboard and Meta Business Suite.
**Files Changed**:
- `backend/src/services/metaCatalogSync.js`: Created new service integrating with Facebook Graph API (`/{catalog-id}/items_batch`) to upsert and delete products.
- `backend/src/routes/products.js`: Integrated `syncProductToMeta` and `deleteProductFromMeta` into the product lifecycle (POST, PUT, DELETE routes).

## 2026-07-01 — Bugfix: Product Creation Fails When AI_API_KEY Is Not Set
**What**: Fixed "Failed to add product" error in the Catalogue. Product creation and update routes crashed because `generateEmbedding()` throws when `AI_API_KEY` is missing. Now embedding generation is wrapped in a try/catch so products save successfully with an empty vector. Also mapped frontend inventory fields (`available_for_sale`, `track_inventory`, `allow_backorder`, `quantity`) to the correct Mongoose schema fields (`inventory_available`, `inventory_quantity`, `inventory_policy`).
**Why**: The `AI_API_KEY` environment variable is optional and may not be configured yet. Products should still be saveable to the catalogue without AI embeddings — the bot just won't be able to semantically match them until the key is added.
**Files Changed**:
- `backend/src/routes/products.js`: Made `generateEmbedding` optional with graceful fallback in both `POST /` and `PUT /:id` routes. Added error logging. Fixed field name mapping to match Product model schema.

## 2026-07-01 — Bugfix & Feature: Implement `/api/v1/analytics/dashboard` Endpoint with Mongoose Aggregation
**What**: Resolved `GET http://localhost:5173/api/v1/analytics/dashboard 404 (Not Found)` error by updating `backend/src/routes/analytics.js` to support the `/dashboard` route and return structured metrics expected by the new frontend `Overview.jsx` component.
**Why**: When the frontend components were synchronized from the reference platform, `Overview.jsx` called `/api/v1/analytics/dashboard` expecting top-level `metrics` (`totalContacts`, `totalOrders`, `totalRevenue`, `totalCampaigns`, `totalConversations`) and time-series arrays. The local backend analytics route was a legacy stub returning only `summary` on `/`. Replaced the stub with complete Mongoose aggregations across `Order`, `Contact`, `WhatsAppCampaign`, `WhatsAppConversation`, and `WhatsAppChatMessage` models.
**Files Changed**:
- `backend/src/routes/analytics.js`: Replaced stub route with full MongoDB aggregation pipeline supporting both `/` and `/dashboard` endpoints.

## 2026-07-01 — Refactor: Remove Multi-Tenant Authentication & Marketing Landing Page for Dedicated Admin Login
**What**: Removed multi-tenant user signup tabs, registration forms, and pricing landing page. Streamlined authentication to a direct single-client workspace login supporting default `admin` / `admin123` credentials. Mounted global tenant loading middleware across all backend API routes.
**Why**: For a single-user platform without subscription upgrade plans, marketing pricing pages and self-service registration flows were unnecessary. The platform now directly prompts unauthenticated users for admin credentials (`admin` / `admin123`) to access the complete workspace.
**Files Changed**:
- `frontend/src/App.jsx`: Removed `LandingPage` component import and unauthenticated route branching. Unauthenticated visitors are routed directly to `AuthPage`.
- `frontend/src/components/Login.jsx`: Removed "Sign Up" tabs, registration form fields, and signup mode switcher. Added an informational badge displaying default `admin` / `admin123` credentials.
- `frontend/src/components/LandingPage.jsx` & `frontend/src/styles/landing.css`: Deleted obsolete SaaS marketing landing page and pricing stylesheet.
- `backend/src/routes/auth.js`: Enhanced `/api/v1/auth/login` to trim inputs and robustly validate single-client `admin` / `admin123` credentials, returning `subscription_plan: 'commerce'` by default.
- `backend/src/app.js`: Mounted `loadSettings` middleware globally before routes so all endpoints automatically attach single-tenant context.

## 2026-07-02 — Razorpay DB Credentials Support
**What**: Added `razorpay_key_id` and `razorpay_key_secret` to the `Setting` Mongoose schema.
**Why**: Previously, Razorpay keys were only readable from `process.env`. If injected into the database directly, Mongoose would strip them due to strict schema validation. Adding them to the schema allows the webhook and checkout routes to dynamically read the tenant's Razorpay credentials from the database.
**Files Changed**: `backend/src/models/Setting.js`

## 2026-07-02 — Direct Razorpay Link in WhatsApp Cart
**What**: Bypassed the non-existent frontend checkout page and updated the webhook to generate and send Razorpay Payment Links directly to the customer in the chat.
**Why**: The `frontend/src/` did not contain a `/checkout` route, leading to broken links when customers tried to pay. Generating the Razorpay link via `razorpay.paymentLink.create()` directly in the webhook provides a seamless, one-click payment experience.
**Files Changed**: `backend/src/routes/webhook.js`, `backend/src/routes/checkout.js`
- Replaced the frontend `/checkout/:token` URL in the WhatsApp reply with a direct Razorpay `short_url`.
- Added a fallback `/api/v1/checkout/mock-payment/:orderId` route to simulate Razorpay payment success pages when using `.env` test credentials.

## 2026-07-02 — Razorpay Test Credentials & Mocking Support
**What**: Added support for `.env` fallback for Razorpay credentials and implemented a mock payment link generator for test credentials.
**Why**: To allow for seamless end-to-end testing of the checkout flow without requiring immediate valid Razorpay API keys.
**Files Changed**: `backend/.env`, `backend/src/routes/checkout.js`
- Created `.env` and populated `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with mock `demo_key` values.
- Updated `maybeCreatePaymentLink` to check `process.env` if tenant settings are missing.
- Added logic to bypass the real Razorpay API and generate a functional mock payment link when a `demo_key` is detected.

## 2026-07-02 — WhatsApp Cart Checkout Link Integration
**What**: Updated the WhatsApp Shopping Cart webhook to automatically generate a secure checkout link and send it in the confirmation reply.
**Why**: Previously, when a customer placed an order via the WhatsApp catalog, the bot simply replied "Our team will process it shortly." Now, the bot generates a unique `checkout_token` and provides a direct link to the platform's hosted checkout page so the customer can immediately enter their delivery details and pay via Razorpay.
**Files Changed**: `backend/src/routes/webhook.js`
- Modified the `msg.type === 'order'` handler to generate a `crypto.randomBytes` checkout token.
- Updated the order creation payload to initialize `checkout_status: 'open'`.
- Changed the `confirmText` response to include the full `https://.../checkout/:token` URL.

## 2026-07-02 — Fixed Broadcast UI Filter Mismatch
**What**: Ensured that the "Send Broadcast" functionality respects the frontend UI filters (Location, Ticket Size, Search) instead of ignoring them and broadcasting to the entire contact list.
**Why**: When sending a broadcast (with "All Contacts" or "Labeled" options), the frontend correctly displayed a filtered count (e.g., "Sending to 2 contacts"), but the backend ignored those extra filters and sent the broadcast to everyone in the database, causing a mismatch and unintended messages.
**Files Changed**: `frontend/src/components/WhatsAppBroadcast.jsx`, `backend/src/routes/whatsapp.js`
- `WhatsAppBroadcast.jsx`: Updated `confirmSend` to pass all active UI filters (`location`, `min_ticket`, `max_ticket`, `search`) in the `recipientFilter` payload.
- `whatsapp.js`: Updated the `POST /broadcast` endpoint to construct a comprehensive MongoDB query using those filters for all non-custom broadcasts.

## 2026-07-02 — Fixed Meta Image Fetch Failures (Vercel Storage Issue)
**What**: Migrated local product image uploads to store directly in MongoDB instead of Vercel's temporary disk.
**Why**: Because Vercel uses ephemeral serverless functions, images saved to disk (`/tmp`) were deleted immediately. When Meta Commerce Manager tried to fetch the image URLs, it received 404 Not Found errors, causing Meta to reject the products due to "broken image links". 
**Files Changed**: `backend/src/models/Image.js`, `backend/src/routes/products.js`
- Created a new `Image` mongoose model to store binary image data and content types.
- Rewrote the multer upload middleware to use `memoryStorage()` instead of `diskStorage()`.
- Created a new `/api/v1/products/images/:filename` route to serve images directly from the database, ensuring permanent availability for Meta's crawlers.

## 2026-07-02 — Bulk Push to Meta Catalog Functionality
**What**: Added a new `/api/v1/products/push-to-meta` backend route and a "Push to Meta" button on the frontend Catalogue page.
**Why**: Products added to Meta Commerce Manager via a Data Feed do not automatically map to the WhatsApp Sales Channel unless manually configured. Pushing products via the Meta Graph API automatically assigns them to WhatsApp, ensuring all active products are visible in the WhatsApp catalog to customers.
**Files Changed**: `backend/src/routes/products.js`, `frontend/src/components/Catalogue.jsx`
- `backend/src/routes/products.js`: Created the `POST /push-to-meta` endpoint which iterates over all local products and pushes them to Meta via `syncProductToMeta`.
- `frontend/src/components/Catalogue.jsx`: Added a UI button next to "Sync from Meta" to trigger the bulk push process.

## 2026-07-02 — Enhanced Cart Display in Chat Inbox
**What**: Updated the webhook logic to fetch product details *before* saving the chat message, so the Chat Inbox now displays the full list of ordered items and the total amount.
**Why**: The user requested that the "🛒 Shopping Cart" bubble in the Chat Inbox show the exact items the customer ordered instead of a generic "Cart Received: X items" message.
**Files Changed**: `backend/src/routes/webhook.js`
- Restructured `msg.type === 'order'` to fetch `Product` models by SKU immediately.
- Formats `bodyText` to include a bulleted list of product names and quantities, plus the total price.
- Reuses the parsed product data for the `Order.create` step to optimize database queries.

## 2026-07-02 — Fixed Webhook Crash on Cart Submission
**What**: Added `order` to the `message_type` enum in the `WhatsAppChatMessage` database schema.
**Why**: When the webhook tried to save the incoming cart message, Mongoose threw a strict schema validation error because `'order'` was not an allowed `message_type` enum value. This caused the webhook to crash silently before it could create the actual `Order` or emit updates to the frontend Chat Inbox.
**Files Changed**: `backend/src/models/WhatsAppChatMessage.js`
- Expanded the `message_type` enum to include `'order'`.

## 2026-07-02 — WhatsApp Native Cart Processing & Chat Inbox Rendering
**What**: Added webhook handling for `msg.type === 'order'` and fixed the frontend Chat Inbox to properly render incoming shopping carts.
**Why**: When customers submitted a shopping cart, the webhook ignored it, and the Chat Inbox frontend mistakenly required a `media_id` to render `order` type messages, causing them to remain completely invisible in the admin dashboard.
**Files Changed**: `backend/src/routes/webhook.js`, `frontend/src/components/WhatsAppChat.jsx`
- Added backend parsing for `msg.order.product_items`.
- Dynamically imports `Order` and `Product` models to map cart SKUs to local prices.
- Creates a new `Order` record in the database.
- Automatically sends a confirmation chat message containing the order total to the customer.
- Updated `WhatsAppChat.jsx` to render a beautiful "🛒 Shopping Cart" bubble in the Chat Inbox when a customer sends an order, even without an attached product thumbnail image.

## 2026-07-02 — Native WhatsApp Catalog Product Messages
**What**: Updated the bot webhook to send an interactive Single Product Message instead of a plain text image when a product is retrieved.
**Why**: The bot was sending basic plain-text images with prices. By leveraging the Meta interactive product message type, the bot now displays native WhatsApp storefront cards, which look much more professional and allow direct catalog viewing.
**Files Changed**: `backend/src/routes/webhook.js`
- Modified the `botReply.type === 'product'` block to construct an interactive payload using `whatsapp_catalog_id` and `product.sku`.
- Falls back to the previous image text message if the catalog ID is missing.

## 2026-07-02 — WhatsApp Template Rendering in Chat Inbox
**What**: Updated broadcast processing to render the actual template body instead of placeholder text in the Chat Inbox.
**Why**: Users were seeing `[Broadcast Template: ...]` instead of the actual content of the broadcasted template in the chat view.
**Files Changed**: `backend/src/routes/whatsapp.js`, `backend/src/routes/whatsapp-chat.js`
- Exported template resolution helpers from `whatsapp-chat.js`.
- Applied `resolveTemplateBody` in `processBroadcast` to save the rich template payload to `WhatsAppChatMessage`.

## 2026-07-02 — WhatsApp Sync Fixes & Refactoring: Full Frontend Parity with Reference Platform & Single-Client Adaptation
**What**: Synchronized all frontend UI components, stores, styles, and configurations from the reference platform (`D:\whatsapp_broadcast_saas`), while stripping out subscription plan paywalls and billing workflows to maintain the single-client architecture.
**Why**: The user noticed that while backend features were ported earlier, the rich frontend UI capabilities—including Shopify Sync, AI Assistant Phase 2 testing & clustering console, brand theme customizer, and new catalogue management tools—were missing in the project frontend.
**Files Changed**:
- `frontend/src/components/*`: Copied updated components from reference platform (`Catalogue.jsx`, `KnowledgeBase.jsx`, `Orders.jsx`, `Overview.jsx`, `WhatsAppChat.jsx`, `WhatsAppBroadcast.jsx`), and adapted `Settings.jsx`, `Sidebar.jsx`, and `AdminPanel.jsx` to remove subscription tabs, plan badges, and upgrade buttons.
- `frontend/src/stores/store.js`: Integrated Shopify integration actions (`fetchShopifyIntegration`, `saveShopifyIntegration`, `syncShopifyProducts`) and AI Assistant actions (`fetchAiAssistantOverview`, `runAiAssistantTest`, `clusterAiAssistantSuggestions`).
- `frontend/src/config/plans.js`: Configured `normalizePlanId` and `canAccessView` to grant full workspace access without feature gating or plan restrictions.
- `frontend/src/App.jsx`: Added brand theme customization (`brandTheme`) and mobile header branding, while removing unused plan upgrade fallbacks and checkout routing.
- `frontend/src/styles/*`: Replaced styles with full reference theme stylesheets (`main.css` and `landing.css`).

## 2026-07-01 — Architecture Refactor: Single-Client Transition & Subscription Plan Deletion
**What**: Removed multi-tenant subscription plan infrastructure and restrictions across frontend and backend components to transition the platform into a dedicated, single-client architecture.
**Why**: The platform is intended for single-client usage rather than multi-tenant SaaS plan tiers. Plan restrictions, trial timers, user limits, and subscription badges were redundant and confusing in a single-owner deployment.
**Files Changed**:
- `backend/src/config/plans.js`: Updated all plan definitions to include all features, unlimited users (`99999`), and default WhatsApp enablement. `canUseFeature()` now always returns `true`.
- `backend/src/middleware/limits.js`: Bypassed `checkUserLimit` and removed trial plan restrictions in `checkWhatsAppEnabled`.
- `backend/src/routes/public.js`: Updated signup route to create clients with active `commerce` (unlimited) access without trial timers.
- `frontend/src/stores/store.js`: Removed subscription/trial expiration error redirection in the API client.
- `frontend/src/components/Settings.jsx`: Removed the "Subscription" tab and plan management UI.
- `frontend/src/components/AdminPanel.jsx`: Removed `PLAN_OPTIONS`, plan badges, and plan edit select fields.
- `frontend/src/components/LandingPage.jsx`: Removed references to 14-day free trials.

## 2026-07-01 — Feature & Fix: Complete Mongoose Migration for AI Bot Intelligence & Webhook Smart Responder
**What**: Migrated `smartResponder.js`, `retrievalEngine.js`, `botLearning.js`, and `smartFlows.js` from legacy SQL to Mongoose/MongoDB, integrated automated bot replies in `webhook.js`, and unified singleton settings retrieval across `loadSettings.js` and `webhook.js`.
**Why**: To complete the backend migration to MongoDB and ensure full functional parity with the reference platform. The AI bot responder now answers incoming customer queries with hybrid retrieval (vector embeddings + lexical search), handles disambiguation ("Did you mean?"), product searches, and human agent handoffs. Additionally, robust singleton ID fallback logic prevents multi-tenant tenant_id mismatches between the admin dashboard and webhook handlers.
**Files Changed**:
- `backend/src/routes/webhook.js`: Integrated `handleSmartReply`, disambiguation list handling, and fallback `Setting.findOne()` logic.
- `backend/src/middleware/loadSettings.js`: Hardened global setting lookup to persist and normalize `singletonId: 'admin_settings'`.
- `backend/src/services/smartResponder.js`: Ported from SQL database helper to Mongoose models (`KnowledgeBase`, `Product`, `Order`).

## 2026-07-01 — Fix: Serverless Read-Only Filesystem Uploads Compatibility (`/var/task/uploads`)
**What**: Created `getUploadsDir()` utility in `backend/src/utils/uploads.js` and updated all file/media upload routes and static file serving in `app.js`, `products.js`, and `whatsapp-chat.js`.
**Why**: In serverless runtime environments like Vercel and AWS Lambda, the working directory (`process.cwd()` / `/var/task`) is read-only. Attempting to upload attachments or media in the Chat Inbox failed with `ENOENT: no such file or directory, mkdir '/var/task/uploads'`. The new utility dynamically detects serverless environments and read-only filesystems and falls back to writing files in `/tmp/uploads` (`os.tmpdir()/uploads`), while serving static files cleanly.
**Files Changed**:
- `backend/src/utils/uploads.js`: Created new helper utility for serverless-safe uploads directory resolution.
- `backend/src/app.js`: Updated express static route `/api/v1/uploads` to serve from `getUploadsDir()`.
- `backend/src/routes/whatsapp-chat.js`: Updated local media storage and stream reading to use `getUploadsDir()`.
- `backend/src/routes/products.js`: Updated multer diskStorage destination to use `getUploadsDir()`.

## 2026-07-01 — Fix: Serverless Cold Start DB Buffering in Webhook Handler
**What**: Added explicit `await initDatabase()` to the start of the webhook POST handler in `backend/src/routes/webhook.js`.
**Why**: In serverless deployment environments like Vercel, top-level asynchronous database initialization promises may not complete before incoming webhook requests hit Lambda functions on cold start. By awaiting database initialization inside the route handler and adding fallback logic for `Setting.findOne()`, we prevent Mongoose connection buffering timeouts when Meta WhatsApp webhooks are received.
**Files Changed**:
- `backend/src/routes/webhook.js`: Imported `initDatabase` and awaited it at the start of `router.post('/')`. Added fallback query logic for `Setting`.

## 2026-07-01 — Feature: Sync Broadcast Messages to Chat Inbox & Auto-Link Contacts
**What**: Synced broadcast campaign messages to the WhatsApp Chat Inbox and added automatic contact lookup/creation in webhooks and broadcasts.
**Why**: When broadcast campaigns were sent from the Broadcast tab (`processBroadcast`), messages were logged to `WhatsAppMessage` but did not create or update records in `WhatsAppConversation` or `WhatsAppChatMessage`. As a result, contacts who were sent campaigns (like `maulik`) did not appear in the Chat Inbox until they replied. Additionally, inbound messages in `webhook.js` were creating conversations without linking `contact_id`. Now, all outgoing broadcast messages create/update conversations, link contacts, and appear in the Chat Inbox. A backfill script was also run to sync existing sent broadcast messages.
**Files Changed**:
- `backend/src/routes/whatsapp.js`: Updated `processBroadcast` to find or create `WhatsAppConversation` and insert `WhatsAppChatMessage` records for successfully sent broadcast messages.
- `backend/src/routes/webhook.js`: Added automatic `Contact` lookup/creation when inbound webhook messages arrive to ensure `contact_id` and `contact_name` are linked.

## 2026-07-01 — Fix: WhatsAppChatMessage sent_by Cast to ObjectId Validation Error
**What**: Fixed Mongoose validation error `sent_by: Cast to ObjectId failed for value "admin-user-id"` when sending outbound chat messages or templates.
**Why**: In the single-user admin authentication setup, `req.user.userId` is the literal string `"admin-user-id"`. However, the `WhatsAppChatMessage` model defined `sent_by` as an `ObjectId` reference to `User`. This mismatch caused Mongoose to throw a validation error whenever an outbound message was created. The field was updated to `String` (matching `WhatsAppCampaign.sent_by`), and `.populate('sent_by')` was removed from chat query routes.
**Files Changed**:
- `backend/src/models/WhatsAppChatMessage.js`: Changed `sent_by` schema definition from `ObjectId` to `String`.
- `backend/src/routes/whatsapp-chat.js`: Removed `.populate('sent_by', 'name')` and updated `sender_name` mapping to support string user IDs.

## 2026-06-30 — Feature: WhatsApp Chat Inbox MongoDB Migration
**What**: Migrated the `whatsapp-chat.js` routes and Meta `webhook.js` to use MongoDB models and re-enabled the chat inbox functionality.
**Why**: The chat inbox routes were temporarily stubbed during the MongoDB migration because they relied on raw MySQL queries. This caused the chat inbox to show "No conversations found" and "replies not shows" on incoming messages. The webhooks now correctly process and store incoming messages into MongoDB, creating conversations seamlessly.
**Files Changed**:
- `backend/src/models/WhatsAppConversation.js`: Created Mongoose schema for chat conversations.
- `backend/src/models/WhatsAppChatMessage.js`: Created Mongoose schema for chat messages.
- `backend/src/routes/whatsapp-chat.js`: Completely rewritten using Mongoose models.
- `backend/src/routes/webhook.js`: Rewritten to process incoming messages from Meta and store them into MongoDB.
- `backend/src/app.js`: Re-enabled the `whatsappChatRoutes` mounting.
- `frontend/src/components/WhatsAppChat.jsx`: Updated `parseUTC` to correctly handle ISO date strings returned by MongoDB.

## 2026-06-29 — Fix: WhatsApp Templates Not Fetching (WABA ID Setup)
**What**: Fixed an issue where the frontend dropdown for WhatsApp Broadcast templates was empty because the Meta Graph API returned an error `(#100) Tried accessing nonexisting field (message_templates)`.
**Why**: The user had mistakenly configured their `whatsapp_business_account_id` in the Settings tab using the Meta App ID instead of the actual WhatsApp Business Account ID. This caused the backend template fetching to fail silently in the API payload, resulting in an empty templates list on the frontend. The `whatsapp_business_account_id` setting was directly corrected in the MongoDB `settings` collection to the correct WABA ID.
**Files Changed**:
- Database: Updated `settings` collection document to correct `whatsapp_business_account_id`.

## 2026-06-24 — Feature: WhatsApp Broadcast Routes MongoDB Migration
**What**: Migrated the `whatsapp.js` routes to use MongoDB models and re-enabled the broadcast functionality.
**Why**: The broadcast routes were temporarily stubbed and disabled during the MongoDB migration because they heavily relied on raw MySQL queries (`query`, `run`, `get`). This caused templates to not fetch properly and broadcast functions to fail silently.
**Files Changed**:
- `backend/src/models/WhatsAppCampaign.js`: Created Mongoose schema for campaigns.
- `backend/src/models/WhatsAppMessage.js`: Created Mongoose schema for broadcast messages.
- `backend/src/middleware/loadSettings.js`: Added middleware to load settings from MongoDB and attach to `req.tenant` for WhatsApp service compatibility.
- `backend/src/routes/whatsapp.js`: Completely rewritten using Mongoose `Contact`, `WhatsAppCampaign`, and `WhatsAppMessage` models.
- `backend/src/app.js`: Re-enabled the `whatsappRoutes` mounting.

## 2026-06-24 — Fix: whatsappTemplates.filter TypeError Crash
**What**: Fixed `(whatsappTemplates || []).filter is not a function` TypeError that crashed the Broadcast and Chat Inbox pages.
**Why**: The Meta WhatsApp API returns templates inside `{ data: [...] }`. The backend correctly unwraps this, but if the API returned an unexpected shape or the fetch failed, `whatsappTemplates` could become a truthy non-array object. The `|| []` fallback only handles falsy values (null/undefined), not objects.
**Files Changed**:
- `frontend/src/stores/store.js`: Made `fetchWhatsAppTemplates` defensive — extracts array from response using `Array.isArray` check, handles `response.data` fallback, and resets state to `[]` on error.
- `frontend/src/components/WhatsAppBroadcast.jsx`: Replaced `(whatsappTemplates || [])` with `Array.isArray(whatsappTemplates) ? whatsappTemplates : []` for both the approved templates filter and the template list rendering.
- `frontend/src/components/WhatsAppChat.jsx`: Same defensive array check for template filtering.

## 2026-06-23 — Architecture: MongoDB Migration & Single User Mode
**What**: Migrated the core database engine from MySQL to MongoDB, replaced the multi-tenant SaaS architecture with a single-user system, and hardcoded the authentication.
**Why**: User requested to use a specific MongoDB cluster, remove all payment methods, and make the platform tailored for a single user without multi-tenancy.
**Files Changed**:
- `backend/src/routes/*`: Rewrote `auth.js`, `contacts.js`, `products.js`, `orders.js`, `tenant-settings.js`, `knowledge-base.js`, `analytics.js` to use Mongoose methods.
- `backend/src/app.js`: Temporarily stripped SQL webhooks and tenant logic to allow the app to boot.
- `backend/src/server.js`: Removed Razorpay cron job.
- `backend/src/routes/tenant-settings.js`: Fixed payload destructuring error causing a 500 when saving WhatsApp config.
- `backend/src/models/*`: Removed outdated `pre('save')` hooks with `next()` callbacks that were causing Mongoose 9.x crashes.
- `frontend/src/index.jsx`: Fixed Vite HMR DOM duplication bug where the app rendered twice, causing overlapping UI.
- `frontend/src/components/Login.jsx`: Changed email input to text input to allow 'admin' username without HTML5 validation errors.

## 2026-06-23 — Config: Removed Hardcoded Hostinger Credentials for Local Dev
**What**: Removed hardcoded Hostinger SMTP credentials from the backend, updated `.env.example`, and updated Vite proxy to default localhost.
**Why**: To allow the application to run smoothly in a local development environment without depending on Hostinger's SMTP or Innodify domains.
**Files Changed**:
- `backend/src/routes/leads.js`: Replaced hardcoded 'smtp.hostinger.com' and 'broadcast@innodify.in' with `process.env` equivalents.
- `backend/.env.example`: Added default SMTP env vars and changed SUPER_ADMIN_EMAILS to localhost.
- `frontend/vite.config.js`: Changed default proxy port from 3001 to 3000 to match backend default.

## 2026-06-18 — Feature: Password Visibility Toggle
**What**: Added a show/hide password toggle button to the login and registration forms.
**Why**: Enhances user experience by allowing users to verify their typed passwords before submission, reducing login errors.
**Files Changed**:
- `frontend/src/components/Login.jsx`: Implemented the `showPassword` state and an inline absolute-positioned icon button within the password input wrapper.
- `frontend/src/components/Icons.jsx`: Added the `eye-off` icon SVG definition.

## 2026-06-18 — Feature: WhatsApp Call Functionality in Chat Inbox
**What**: Added Voice Call and Video Call buttons directly within the Chat Inbox header.
**Why**: Agents need a quick way to initiate calls with customers directly from their conversation view. The buttons now utilize the WhatsApp `wa.me` deep link protocol to instantly open the customer's chat inside the native WhatsApp Desktop or Web app, from where the agent can click the call button.
**Files Changed**:
- `frontend/src/components/WhatsAppChat.jsx`: Inserted `phone` and `video` icon buttons in the chat header, triggering the `wa.me` deep link. Added informational toast.
- `frontend/src/components/Icons.jsx`: Added the `video` icon SVG definition.

## 2026-06-17 - Coworker Support Flow Review Fixes
**What**: Reviewed the latest `origin/main` support-flow/payment-reminder batch, restored the shopping-intent gate, phone-scoped customer order cancellation, removed the placeholder support phone fallback, and strengthened backend regression coverage.
**Why**: The pulled coworker implementation made every customer text bypass Smart Responder with the generic menu, allowed cancel-order actions to address any same-tenant order ID, and could expose a fake support number when tenant phone was not configured.
**Impact**: General FAQ/customer text messages can reach Smart Responder again, cancel-order button actions only affect orders owned by the requesting WhatsApp phone, and call-request support responses no longer send a placeholder contact card.
**Files Changed**: `backend/src/app.js`, `backend/test/regression.test.js`, `knowledge-base/active-context.md`, `knowledge-base/changelog.md`, `knowledge-base/known-issues.md`, `knowledge-base/testing.md`
**Tests**: PASS - `npm test` from `backend/` after first verifying the new regression assertions failed on the pulled remote state; PASS - backend `node --check`; PASS - `npm run lint` and `npm run build` from `frontend/`; PASS - high-severity npm audits in both apps; PASS - `git diff --check`.
**Commit**: Not available

- Pulled `origin/main` at `de02ca0` and reviewed commits after `91eb6a0`.
- Fixed the broad `messageType === 'text'` shopping menu gate by restoring explicit product/category intent keywords.
- Scoped cancel-order lookup/update SQL by `tenant_id` and `phone`, with a safe no-order response instead of false cancellation success.
- Replaced the hardcoded `+919876543210` support fallback with a tenant-phone-required contact-card path.

## 2026-06-17 — Fix: Welcome Menu Auto-Responder Override
**What**: Removed the regex constraint (`/\b(shop|shopping.../i`) that was recently added to the `shouldOfferShoppingOptions` flag. 
**Why**: The regex restricted the "Welcome Menu" (Shop Categories / Customer Support) to only trigger if the customer used specific shopping keywords. This caused a bug where standard messages like "Hi" or "Hello" received no auto-reply menu. Reverting this ensures the Welcome Menu acts as the global default auto-responder for all unhandled text messages.
**Files Changed**:
- `backend/src/app.js`: Reverted `shouldOfferShoppingOptions` back to strictly `messageType === 'text'`.

---

## 2026-06-17 — Feature: Contextual Order Selection in Support Flow
**What**: Modified the customer support flow so that when a customer selects any support topic (like "Payment Issues" or "Order Status"), the system now checks if they have any recent orders. If they do, it automatically sends an interactive list of their last 5 orders, prompting them to select which order they need help with *before* asking them how they want to contact us.
**Why**: To provide agents with immediate, exact context about which order the customer is asking about, dramatically reducing back-and-forth and improving resolution times.
**Files Changed**:
- `backend/src/app.js`: Updated the support topic handler to query the `orders` table by `tenant_id` and `phone`. If orders exist, it serves a `type: "list"` message containing those orders. Added a new handler for `support_order_*` list replies to proceed to the Chat/Call contact options.

---

## 2026-06-17 — Feature: Auto-Resume Bot on Interactive Options
**What**: Added logic to automatically unpause the AI bot if a customer clicks any menu option (interactive list or button) while in a paused/live-agent state.
**Why**: To prevent the bot from ignoring user commands if they voluntarily try to return to the automated flow (e.g. by clicking "Shop Categories" from an older message). Text messages remain paused so agents can chat freely, but menu interactions immediately hand control back to the bot.
**Files Changed**:
- `backend/src/app.js`: Updated the early return condition for `bot_paused` in `processIncomingMessage` to automatically unset the pause flag in the database and emit a WebSocket event if the incoming message is an `interactive_button` or `interactive_list`.

---

## 2026-06-17 — UX: Expanded Customer Support Availability & Options
**What**: 
1. Injected the "Customer Support" interactive button into two critical transactional messages: the Payment Link message and the Order Cancellation confirmation message. 
2. Upgraded the main Customer Support triage menu from an interactive button message (which was limited to 3 options) to a full interactive list message, allowing us to include: Order Status, Payment Issues, Shipping & Delivery, Returns & Refunds, Product Info, and General Inquiry.
**Why**: 
1. To ensure users always have a direct, one-tap route to human assistance exactly when they might need it most (when paying or when cancelling an order).
2. To provide a more comprehensive taxonomy of support issues, which helps agents better understand the customer's intent before they even join the chat.
**Files Changed**:
- `backend/src/app.js`: Updated both the Razorpay payment link dispatcher and the cancellation success webhook to send interactive payloads containing the `menu_customer_support` button payload. Converted `menu_customer_support` handler to dispatch a `type: "list"` message instead of `type: "button"` and added `interactive_list` handlers for the new `support_topic_*` IDs.

---

## 2026-06-17 — Feature: Chat Resolution and Automated Feedback
**What**: Added a "Resolve Chat" button to the WhatsApp Inbox UI when the AI bot is paused during live agent support. Clicking this instantly reactivates the bot and sends an interactive feedback request (Thumbs Up/Down) to the customer. We also added automated handlers to process their feedback selection and send an appropriate thank-you message.
**Why**: To provide a clean closure to manual support interactions and gather customer satisfaction data. The system now seamlessly transitions between automated shopping, manual agent intervention (with bot paused), and back to full automation upon resolution.
**Files Changed**:
- `backend/src/routes/whatsapp-chat.js`: Upgraded the `/bot-pause` endpoint to accept a `send_feedback` flag and dispatch an interactive feedback message when resolving chats.
- `backend/src/app.js`: Added handlers for `feedback_good` and `feedback_bad` interactive buttons. Verified that the `bot_paused` flag actively suppresses automated shopping replies during live chat.
- `frontend/src/stores/store.js`: Updated `updateConversationBotPause` to pass the `send_feedback` parameter to the backend.
- `frontend/src/components/WhatsAppChat.jsx`: Enhanced the chat header UI with a dedicated "Resolve Chat" button that appears when the bot is paused.

---

## 2026-06-17 — Feature: Interactive Customer Support Menu
**What**: Transformed the primary fallback auto-responder from a direct category list into a high-level Welcome Menu with "Shop Categories" and "Customer Support" buttons. Added an interactive support triage flow that guides users through selecting their issue (Payment, Shipping, Product) and preferred contact method (WhatsApp Chat vs Phone Call). If the user chooses a Phone Call, the bot automatically sends a native WhatsApp Contact Card (vCard) with the tenant's support number.
**Why**: To provide a more robust and professional automated assistant experience, ensuring users who need help can easily reach human agents, while shoppers can still browse seamlessly. The vCard specifically allows customers to instantly save the support number or dial it with one tap.
**Files Changed**:
- `backend/src/services/whatsapp.js`: Added a new `sendContactMessage` function to support native Meta API `contacts` message types.
- `backend/src/app.js`: Intercepted text messages to serve the new Welcome Menu. Handled payloads for `menu_customer_support`, support topics, and support contact methods. Integrated bot-pausing logic for live agent handoff and implemented the vCard dispatch when a call is requested.

---

## 2026-06-17 — Feature: Order Cancellation and Payment Reminders
**What**: Added a "Cancel Order" interactive button to the payment link message and implemented an automated 15-minute payment reminder system for pending orders. Clicking "Cancel Order" now automatically voids and expires the associated Razorpay payment link.
**Why**: To improve conversion rates by automatically reminding customers to complete their payments, while giving them a quick option to cancel if they changed their mind, keeping the order queue clean and preventing accidental late payments on cancelled orders.
**Files Changed**:
- `backend/src/database.js`: Added `payment_link`, `payment_link_id` and `last_reminder_at` columns to the `orders` table.
- `backend/src/app.js`: Upgraded payment link messages to Interactive Button payloads with a "Cancel Order" quick reply. Added webhook logic to intercept order cancellation requests and make an API call to Razorpay to immediately cancel/expire the payment link.
- `backend/src/services/paymentReminder.js`: Created a new background cron service to scan and dispatch payment reminders every 15 minutes.
- `backend/src/server.js`: Initialized the `startPaymentReminderCron` worker.

---

## 2026-06-17 - Option C UI Polish and Remote Review Fixes
**What**: Polished the dashboard UI, improved responsive store-owner workflows, reviewed the latest `origin/main` coworker commits, and fixed the regressions found in that review.
**Why**: The app needed a cleaner, more polished user experience with smoother edges, a better font, mobile-friendly daily workflows, and a safe merge of concurrent remote work before pushing to GitHub main.
**Impact**: Authenticated users now land on Overview, tenant admins no longer see the super-admin panel link, mobile navigation and Orders cards are usable on phone widths, product uploads reject non-image files, Razorpay webhooks again require tenant webhook secrets/signatures, product Meta sync uses normalized image data, and interactive shopping prompts no longer override normal Smart FAQ replies for every text message.
**Files Changed**: `backend/src/app.js`, `backend/src/routes/products.js`, `backend/test/regression.test.js`, `frontend/src/App.jsx`, `frontend/src/components/Catalogue.jsx`, `frontend/src/components/Login.jsx`, `frontend/src/components/Orders.jsx`, `frontend/src/components/Sidebar.jsx`, `frontend/src/stores/store.js`, `frontend/src/styles/landing.css`, `frontend/src/styles/main.css`, `frontend/vite.config.js`, `knowledge-base/README.md`, `knowledge-base/active-context.md`, `knowledge-base/changelog.md`, `knowledge-base/frontend.md`, `knowledge-base/known-issues.md`, `knowledge-base/testing.md`, `docs/superpowers/specs/2026-06-16-option-c-ui-ux-overhaul-design.md`, `docs/superpowers/plans/2026-06-16-option-c-ui-ux-overhaul.md`
**Tests**: PASS - `npm test` from `backend/`; PASS - backend `node --check` across `backend/src/**/*.js`; PASS - `npm run lint` from `frontend/`; PASS - `npm run build` from `frontend/`; PASS - `npm audit --audit-level=high` from both `frontend/` and `backend/`; PASS - `git diff --check`; PASS - in-app browser QA against `https://broadcast.innodify.in` through local Vite proxy at desktop and 390px phone widths.
**Commit**: Not available

- Replaced the dark login surface and older dashboard styling with a cleaner Plus Jakarta Sans UI layer, lighter app surfaces, improved cards, buttons, forms, tables, chat, catalogue, orders, and landing page polish.
- Added mobile Orders cards, fixed the drawer class contract, and covered those contracts in backend static regression tests.
- Reviewed coworker commits from `origin/main` before pushing; fixed the optional Razorpay signature bypass, upload MIME/type validation gap, Meta product sync normalization, interactive shopping text-message override, and a Catalogue lint warning.
- Added `frontend.md` to document app-shell conventions, responsive rules, and browser QA expectations.

## 2026-06-17 — Feature: Interactive Shopping Auto-Responder
**What**: Updated the native WhatsApp interactive flow to automatically read dynamic product categories from the database instead of hardcoded options, presenting them as an interactive List message.
**Why**: To allow businesses to dynamically update their product categories in the dashboard and have them automatically reflect in the WhatsApp shopping auto-responder flow.
**Files Changed**:
- `backend/src/app.js`: Refactored the custom interactive interceptor to dynamically `SELECT DISTINCT category FROM products` and generate Meta API compliant list messages. Updated the callback handler to query products based on the selected dynamic category.

---

## 2026-06-17 — Feature: Chat Inbox Date Separators
**What**: Added date separators (e.g., "Today", "Yesterday", "15 Jun 2026") between chat messages in the WhatsApp Chat Inbox.
**Why**: To improve readability and match the native WhatsApp chat experience, making it easier for users to track conversation timelines.
**Files Changed**:
- `frontend/src/components/WhatsAppChat.jsx`: Implemented `formatDateSeparator` and added logic to render date blocks between messages when the date changes.

---

## 2026-06-16 — Feature: WhatsApp Broadcast UI Polish
**What**: Removed the "By Tag" filter option from the WhatsApp Broadcast interface and fixed the missing icon for "Smart FAQs" in the sidebar navigation.
**Why**: Based on user request, the tag filter was removed to simplify the recipient selection options. The Smart FAQs icon was not rendering due to an invalid icon name mapping, which has now been corrected.
**Files Changed**:
- `frontend/src/components/WhatsAppBroadcast.jsx`: Removed "By Tag" option and associated logic.
- `backend/src/routes/whatsapp.js`: Removed tag filtering block from the broadcast API.
- `frontend/src/stores/store.js`: Removed `tag` from `fetchWhatsAppRecipients`.
- `frontend/src/components/Sidebar.jsx`: Corrected icon name for Smart FAQs.

---

## 2026-06-16 — Fix: WhatsApp Broadcast Recipient Filtering
**What**: Fixed the "By Label" and "By Tag" filter logic in the WhatsApp Broadcast interface to properly preview the suggested contact count and made the matching case-insensitive.
**Why**: Selecting "By Label" was not updating the preview count correctly because the frontend was not passing the label parameter to the API, and the backend was missing the label check. Additionally, `JSON_CONTAINS` is strictly case-sensitive in MySQL, meaning searching for "vip" failed to match contacts tagged as "VIP".
**Files Changed**:
- `backend/src/routes/whatsapp.js`: Added `label` checking in the `GET /recipients` API.
- `frontend/src/stores/store.js`: Updated `fetchWhatsAppRecipients` to accept a flexible `filters` object including `label`.
- `frontend/src/components/WhatsAppBroadcast.jsx`: Refactored the `useEffect` hook to explicitly pass `tag` and `label` only when the respective recipient type is selected.

---

## 2026-06-16 — Fix: Webhook Signature Backward Compatibility
**What**: Made the Razorpay Webhook Signature verification optional if the secret is not configured.
**Why**: During the recent security audit, signatures were made mandatory, which broke the automatic "Payment Received" WhatsApp confirmation for existing users who had not yet configured their Webhook Secret in the Settings dashboard.
**Files Changed**:
- `backend/src/app.js`: Bypassed signature check if `webhookSecret` is empty.

---

## 2026-06-16 — Feature: Multiple Image Uploads for Products
**What**: Upgraded the product catalogue to support multiple image uploads instead of just a single image URL, and enabled multi-image sync to Meta Catalog.
**Why**: Allows adding additional images for a richer product gallery in both the dashboard and WhatsApp Business catalog.
**Files Changed**:
- `backend/src/database.js`: Added `images` JSON column to the `products` table.
- `backend/src/routes/products.js`: Added `POST /upload-images` endpoint and updated product creation/editing to accept an array of images.
- `backend/src/services/whatsapp.js`: Updated `syncProductToMeta` to pass extra images via `additional_image_links`.
- `frontend/src/components/Catalogue.jsx`: Refactored the UI to accept multiple files, render an image grid thumbnail preview, and allow removing uploaded images. Also improved card styling to be premium and square with blurred backdrops.

---

## 2026-06-16 — Security, Realtime, Bot Pause, Lint, and Dependency Fixes
**What**: Fixed all documented review findings and added regression coverage for the critical paths.
**Why**: The review found exposed diagnostics, unsigned payment webhooks, schema drift, realtime refresh mismatch, UI-only bot pause, settings secret rehydration, red lint, secret-like docs, and dependency audit vulnerabilities.
**Impact**: Razorpay payment webhooks now require tenant-specific valid signatures; public chat diagnostics are removed; bot pause is persisted and enforced server-side; label broadcasts can insert campaign rows; settings reads no longer return Razorpay secrets; frontend lint/build and dependency audits are green. Vite was upgraded to 8 and local embeddings now import from `@huggingface/transformers`.
**Files Changed**:
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/app.js`
- `backend/src/database.js`
- `backend/src/routes/tenant-settings.js`
- `backend/src/routes/whatsapp-chat.js`
- `backend/src/services/smartResponder.js`
- `backend/src/utils/security.js`
- `backend/src/utils/settings-security.js`
- `backend/test/regression.test.js`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/eslint.config.js`
- `frontend/vite.config.js`
- `frontend/src/components/Catalogue.jsx`
- `frontend/src/components/Contacts.jsx`
- `frontend/src/components/KnowledgeBase.jsx`
- `frontend/src/components/Orders.jsx`
- `frontend/src/components/Overview.jsx`
- `frontend/src/components/WhatsAppBroadcast.jsx`
- `frontend/src/components/WhatsAppChat.jsx`
- `frontend/src/stores/store.js`
- `frontend/src/utils/helpers.js`
- `knowledge-base/DEPLOYMENT.md`
- `knowledge-base/README.md`
- `knowledge-base/active-context.md`
- `knowledge-base/changelog.md`
- `knowledge-base/decisions.md`
- `knowledge-base/known-issues.md`
- `knowledge-base/security.md`
- `knowledge-base/testing.md`
**Tests**: PASS - `npm test` from `backend/` (8 tests); PASS - backend `node --check` across `backend/src/**/*.js`; PASS - `npm run lint` from `frontend/`; PASS - `npm run build` from `frontend/`; PASS - `npm audit --audit-level=high` from both `frontend/` and `backend/`; PASS - targeted `rg` secret-pattern scan returned no matches.
**Commit**: Not available

- Removed the public `/api/v1/debug/chat-status` endpoint.
- Added Razorpay webhook HMAC verification against tenant settings before paid-order updates, and tenant-scoped pending-order lookup/update.
- Added persisted `bot_paused` conversation state, a backend pause endpoint, frontend store support, and webhook auto-reply enforcement.
- Added helper utilities for raw-body signature verification, JSON parsing, client-safe settings masking, and blank-secret preservation.
- Fixed Vite 8 `manualChunks` compatibility by converting the object map to a function.
- Added `knowledge-base/security.md` to document webhook, tenant, secret, bot-pause, dependency-audit, and secret-scan conventions.

---

## 2026-06-16 - Detailed Code Review Findings Documentation
**What**: Documented review findings in the knowledge base and added a testing guide for the current verification commands and test gaps.
**Why**: The review found open security, data integrity, realtime chat, bot pause, secret masking, and lint issues that need to be visible to future sessions.
**Impact**: Documentation only. Product behavior is unchanged.
**Files Changed**:
- `knowledge-base/known-issues.md`
- `knowledge-base/active-context.md`
- `knowledge-base/testing.md`
- `knowledge-base/README.md`
- `knowledge-base/changelog.md`
**Tests**: Before documentation updates, `npm run build` in `frontend/` passed; backend `node --check` across `backend/src/**/*.js` passed; `npm run lint` in `frontend/` failed with 11 errors and 37 warnings.
**Commit**: Not available

- Added open issues for the public debug endpoint, unsigned Razorpay webhook, deployment-doc secrets, label broadcast enum mismatch, realtime event key mismatch, UI-only bot pause, settings secret rehydration, and red frontend lint gate.
- Added `testing.md` because no automated test framework exists yet, but build/lint/syntax verification commands are now part of the project handoff.

---

## 2026-06-16 — Feature: Local Image Uploads for Products
**What**: Added an image file upload feature to the "Add/Edit Product" modal in the Catalogue dashboard.
**Why**: Users previously had to paste an existing URL for a product image. Now they can directly upload local image files which are saved and served statically from the backend.
**Files Changed**:
- `backend/src/routes/products.js`: Added `POST /upload-image` endpoint utilizing `multer` with disk storage in `uploads` folder.
- `backend/src/app.js`: Added static file serving (`app.use('/uploads')`) for public access to uploaded images.
- `frontend/src/components/Catalogue.jsx`: Implemented file input, `uploadingImage` state, and `handleImageUpload` function to send `FormData` directly to the new API and auto-fill the URL field.

---

## 2026-06-16 — Sync: Pulled Latest Code
**What**: Executed `git pull origin main` to fetch and accept all incoming changes from the remote repository.
**Why**: User request to sync the local codebase with the remote repository.
**Files Changed**: Multiple backend and frontend files were updated via fast-forward.
**Commit**: `a29bc62`

---

## 2026-06-16 — Fix: Labels Persistence, Auto-Create Contacts, Broadcast Label Filtering
**What**: Three interconnected fixes:
1. Labels now persist on BOTH `whatsapp_conversations.labels` AND `contacts.labels` (synced via PATCH endpoint)
2. New WhatsApp messages auto-create a contact if one doesn't exist for that phone (source='whatsapp')
3. Broadcasts can filter by label — "By Label" button sends `recipientType: 'labeled'` with `recipientFilter: { label: 'vip' }`
**Why**: Labels weren't persisting because the store only updated `activeConversation` but not the conversations list. Labels on conversations alone couldn't be used in broadcasts (which target contacts). New customers messaging on WhatsApp weren't being saved to contacts.
**Impact**: Labels are now the shared taxonomy between Chat, Contacts, and Broadcast. Every WhatsApp customer auto-gets a contact record.
**Files Changed**:
- `backend/src/database.js`: Migration to add `labels` JSON column to `contacts` table
- `backend/src/app.js`: Auto-create contact on new WhatsApp message (INSERT INTO contacts with source='whatsapp')
- `backend/src/routes/whatsapp-chat.js`: Labels PATCH syncs to linked contact via contact_id
- `backend/src/routes/whatsapp.js`: New `recipientType: 'labeled'` filter using `JSON_CONTAINS(labels, ?)`
- `frontend/src/stores/store.js`: Fixed `updateConversationLabels` to update both activeConversation AND conversations list
- `frontend/src/components/WhatsAppChat.jsx`: Fixed `getConvLabels` to handle both array and string types
- `frontend/src/components/WhatsAppBroadcast.jsx`: Added "By Label" button + label dropdown selector
- `frontend/src/components/Contacts.jsx`: Shows label badges alongside tags in contacts table
**Tests**: Frontend builds successfully (71 modules, 0 errors).

## 2026-06-16 — Feature: Load Older Messages (Cursor Pagination)
**What**: Chat messages now load via cursor-based pagination. A "Load Older Messages" button appears when there are more messages.
**Why**: Previously only the latest 100 messages loaded. Long conversations were truncated with no way to see history.
**Impact**: Backend messages endpoint changed from page/offset to `before_id` cursor. Store adds `fetchOlderMessages` and `chatHasMore` state.
**Files Changed**:
- `backend/src/routes/whatsapp-chat.js`: Rewrote messages endpoint with `before_id` cursor, `has_more` flag, fetches latest N by default.
- `frontend/src/stores/store.js`: Added `fetchOlderMessages`, `chatHasMore` state.
- `frontend/src/components/WhatsAppChat.jsx`: Added "↑ Load Older Messages" button at top of messages area.
**Tests**: Frontend builds successfully.

## 2026-06-16 — Feature: Conversation Labels
**What**: 6 color-coded labels (VIP, Follow Up, Complaint, New Order, Pending Payment, Resolved) that can be toggled per conversation via a tag icon dropdown.
**Why**: SMBs need to categorize conversations for prioritization and follow-up tracking.
**Impact**: New `labels` JSON column on `whatsapp_conversations` table. Labels show as colored dots in sidebar and badges in chat header.
**Files Changed**:
- `backend/src/database.js`: Migration to add `labels` JSON column.
- `backend/src/routes/whatsapp-chat.js`: New `PATCH /conversations/:id/labels` endpoint.
- `frontend/src/stores/store.js`: Added `updateConversationLabels` method.
- `frontend/src/components/WhatsAppChat.jsx`: Label picker dropdown, label badges below header, label dots in conversation list.
**Tests**: Frontend builds successfully.

## 2026-06-16 — Feature: Knowledge Base Test Bot
**What**: Collapsible "🧪 Test Your Bot" panel on the Knowledge Base page. Type a customer question → see the bot's matched answer with confidence scores for all top matches.
**Why**: SMBs had no way to verify their FAQ entries were matching correctly without sending real WhatsApp messages.
**Impact**: New `POST /api/v1/knowledge-base/test` endpoint runs cosine similarity against all active FAQs.
**Files Changed**:
- `backend/src/routes/knowledge-base.js`: Added `/test` POST endpoint with local cosineSimilarity function.
- `frontend/src/components/KnowledgeBase.jsx`: Added test bot state, UI panel with input, results display with match scores.
**Tests**: Frontend builds successfully.

## 2026-06-16 — Feature: Orders Overhaul (Phase 1)
**What**: Complete rewrite of Orders page — backend and frontend — with search, filters, sorting, stats, export, bulk actions, and notes.
**Why**: The orders page was a raw data dump. SMBs processing 50+ daily orders need search, date filters, bulk status updates, and CSV export for accounting.
**Impact**: Orders page is now a fully functional order management system.
**Files Changed**:
- `backend/src/routes/orders.js`: Added search, sort_by/sort_order, date_from/date_to params, `/stats` endpoint, `/export` CSV endpoint, `/bulk/status` bulk update, notes in PATCH, input validation.
- `frontend/src/components/Orders.jsx`: Complete rewrite with stat cards, debounced search, payment/fulfillment/date filters, date presets, sortable column headers, checkbox selection, bulk actions bar, CSV export button, editable order notes, improved pagination with page size selector.
**Tests**: Frontend builds successfully (71 modules, 0 errors).

## 2026-06-16 — Feature: Analytics Dashboard
**What**: Added Overview dashboard as the default landing page with custom SVG charts (zero new dependencies).
**Why**: SMBs need an at-a-glance view of revenue, orders, contacts, campaigns, and conversations.
**Files Changed**:
- `backend/src/routes/analytics.js` (NEW): Dashboard metrics API.
- `frontend/src/components/Overview.jsx` (NEW): Custom AreaChart, BarChart, DonutChart components.
- `frontend/src/App.jsx`, `frontend/src/components/Sidebar.jsx`: Wired in as default view.
**Tests**: Frontend builds successfully.

## 2026-06-16 — Feature: Contacts Overhaul
**What**: Complete rewrite of Contacts page with tag/location filter dropdowns, sortable columns, server-side pagination, CSV export, bulk delete, and quick-chat button.
**Why**: Contacts page had no filters, no pagination UI, and no export despite the backend already supporting tags/location filtering.
**Impact**: Contacts are now fully manageable for SMBs with 100s-1000s of contacts.
**Files Changed**:
- `backend/src/routes/contacts.js`: Added sorting (sort_by/sort_order), CSV export endpoint, moved static routes (`/tags/list`, `/locations/list`, `/export`) before `/:id`.
- `frontend/src/components/Contacts.jsx`: Complete rewrite with tag/location filter dropdowns, sortable columns (name, location, ticket_size), pagination with page size selector, CSV export, checkbox selection, bulk delete, WhatsApp quick-chat button.
- `frontend/src/stores/store.js`: Updated `fetchContacts` to pass sort_by, sort_order, location, and limit params.
**Tests**: Frontend builds successfully (71 modules, 0 errors).

## 2026-06-16 — Feature: Catalogue Search, Sort & Filter
**What**: Added client-side search, category filter, and sort options to the product catalogue page.
**Why**: SMBs with 50+ products couldn't find anything without scrolling. Search by name/SKU and sort by price/name makes product management much faster.
**Files Changed**:
- `frontend/src/components/Catalogue.jsx`: Added search input, category filter dropdown, sort selector (newest, name, price), product count.
**Tests**: Frontend builds successfully.

## 2026-06-16 — Feature: Chat Inbox — Quick Replies & Bot Pause
**What**: Added a `/` slash-command quick replies system and per-conversation bot pause toggle to the chat inbox.
**Why**: SMBs answering 50+ chats daily need canned responses. Typing `/` shows a popup of saved replies that can be clicked to insert. Bot pause lets the human agent take over a conversation without the AI bot interfering.
**Files Changed**:
- `frontend/src/components/WhatsAppChat.jsx`: Quick replies state/logic, `/` trigger popup, manage quick replies modal (⚡ icon), bot pause toggle with visual indicator.
- `frontend/src/components/Icons.jsx`: Added `pause`, `play`, `zap` icons.
**Tests**: Frontend builds successfully.

## 2026-06-15 — Feature: Order Management System (OMS) Frontend Dashboard
**What**: Created a fully featured Orders Dashboard and auto-payment settings configuration screen on the frontend.
**Why**: Allows merchants to view orders placed via WhatsApp in a tabular format, filter by payment and fulfillment statuses, view granular line items and customer info, update statuses, and configure auto-payment links for automatic replies.
**Files Changed**:
- `frontend/src/components/Orders.jsx`: Created new Orders page with status filters, detail modals, and status update controls.
- `frontend/src/components/Sidebar.jsx`: Integrated the Orders link into navigation.
- `frontend/src/App.jsx`: Added routing and rendering switcher for the Orders view.
- `frontend/src/components/Settings.jsx`: Integrated state variables and UI fields for the Auto-Payment Link and dynamic template configuration in chatbot settings.
**Tests**: Verified that the frontend builds successfully without any errors.

## 2026-06-15 — Feature: WhatsApp Text Formatting in UI
**What**: Added support for rendering WhatsApp-style markdown (bold, italic, strikethrough, monospace) in the Chat Inbox.
**Why**: When users or customers sent messages with WhatsApp formatting like `*bold*` or `_italic_`, the platform displayed the raw symbols instead of actual formatted text. This update adds a robust regex parser that converts WhatsApp markdown into safe HTML elements, perfectly mimicking the native WhatsApp visual experience.
**Files Changed**: `frontend/src/components/WhatsAppChat.jsx`
- Created `formatWhatsAppText()` utility to safely escape HTML and apply `<strong>`, `<em>`, `<del>`, and `<code>` tags.
- Applied `dangerouslySetInnerHTML` to message and template body containers.

## 2026-06-15 — Feature: WhatsApp Order Message Parsing & Images
**What**: Added parsing, product images, and rich-text formatting for incoming WhatsApp Cart/Order messages.
**Why**: When a customer added a product from the WhatsApp Catalog to their cart and sent it, the webhook received a message of type `order`, but the backend only saved `[order]` as plain text. This update unpacks the Meta `order` payload, queries the `products` table using the SKU/retailer ID to get the actual product names and image URL, and saves a beautifully formatted order summary (with quantities, total price, and the product image) so it's fully readable in the Chat Inbox.
**Files Changed**: `backend/src/app.js`, `frontend/src/components/WhatsAppChat.jsx`
- Replaced the default `[order]` fallback in the webhook with a loop that parses `product_items` and computes totals.
- Extracted `image_url` from the database and saved it into the `media_id` field.
- Updated `WhatsAppChat.jsx` to natively render product images when `message_type === 'order'`.
- Added `whiteSpace: 'pre-wrap'` to the chat body text so that the formatted newlines actually render as line breaks in the UI.

## 2026-06-15 — Fix: Enhanced Meta API Error Visibility
**What**: Improved the error handling for Meta API integrations to capture and forward detailed error metadata directly to the frontend toast notifications.
**Why**: When users encountered "Authorization Error" (e.g. from a restricted or unlinked WhatsApp Business Account), the backend was masking the actual reason because it only looked at the top-level error message instead of parsing `error_user_title`, `error_user_msg`, and `error_data.details`. This fix ensures users know exactly *why* a message failed to send.
**Files Changed**: `backend/src/services/whatsapp.js`
- Added a new global `formatMetaError` utility to extract granular error details from the Meta Graph API response payloads.
- Replaced all raw `data.error?.message` generic throw calls with the detailed formatting helper.

## 2026-06-15 — Fix: WhatsApp Catalog India Compliance Fields
**What**: Added `manufacturer_info` to the Meta Commerce API product sync payload.
**Why**: Products were syncing to the Meta Catalog but failing to display in the WhatsApp Business Catalog in India because Meta compliance rules require both `origin_country` and `manufacturer_info` for India catalogs.
**Files Changed**: `backend/src/services/whatsapp.js`
**Tests**: Verified payload construction.
- Appended `manufacturer_info: tenant.name || 'Manufacturer'` to the `PRODUCT_ITEM` payload in `syncProductToMeta`.

## 2026-06-15 — Fix: Meta Commerce Catalog SKU Match Rate & Deletion Sync
**What**: Removed `PROD-` prefix from Meta Catalog product ID sync, clarified SKU label, and fixed product deletion synchronization.
**Why**: 
- **Match Rate**: Meta Pixel tracks events using the website's native product ID or SKU. The `PROD-` prefix was causing a "Products not matching ad events" error because `PROD-123` doesn't match the pixel's `123`.
- **Deletion**: Deleting products locally did not actually delete them from the Meta Catalog because the Graph API batch payload was missing the required `item_type: 'PRODUCT_ITEM'` field, and errors were silently ignored.
**Files Changed**: `backend/src/services/whatsapp.js`, `frontend/src/components/Catalogue.jsx`, `backend/src/routes/products.js`
**Tests**: Verified syntax and logic changes.
- Changed fallback product ID in `syncProductToMeta` from `` `PROD-${product.id}` `` to `String(product.id)`.
- Updated the SKU label in the Catalogue component to explicitly remind users it must match the "Meta Pixel Content ID".
- Added `item_type: 'PRODUCT_ITEM'` to `deleteProductFromMeta` and configured the route to bubble up Meta deletion errors as toast warnings in the frontend.

## 2026-06-12 — Frontend Optimizations: WebSockets & FAQ Editing UI
**What**: Implemented `socket.io-client` in the React frontend for real-time chat updates, removing the old HTTP polling system. Added UI capabilities to edit existing FAQs in the Knowledge Base dashboard.
**Why**: Completes the frontend counterpart to the backend real-time and semantic search improvements. Polling was inefficient, and FAQ editing is a better user experience than deleting/re-creating.
**Impact**: Chat updates immediately without delay. Less backend load from polling. Users can now edit FAQs with a dedicated UI that triggers backend vector re-calculation.
**Files Changed**: `frontend/package.json`, `frontend/src/App.jsx`, `frontend/src/stores/store.js`, `frontend/src/components/WhatsAppChat.jsx`, `frontend/src/components/KnowledgeBase.jsx`, `backend/src/services/websocket.js`
**Tests**: Verified Socket.io connection initializes upon login, handles disconnects upon logout, and chat polling is removed. Verified the FAQ edit form submits `PUT` requests successfully.

- Installed `socket.io-client`.
- Added `initSocket()` to the Zustand `store.js` that triggers on `isAuthenticated` in `App.jsx`.
- Cleaned up `pollRef` and `setInterval` logic from `WhatsAppChat.jsx`.
- Extended `KnowledgeBase.jsx` form to handle `PUT` requests when an `editingId` is active, and added an edit button to the active FAQs list.
- Configured Socket.io to use the `/api/socket.io` path to ensure compatibility with existing Nginx proxy configurations on the VPS.

---

## 2026-06-12 — Backend Optimizations: WebSockets, NLP Pre-warming, & FAQ Editing
**What**: Implemented Socket.io for real-time chat updates, pre-warmed local NLP models, improved tenant cache invalidation, and added FAQ editing support.
**Why**: Ensures the frontend chat inbox updates instantly without polling, improves first-reply speed of the NLP model, fixes cache collision risks, and allows users to edit FAQs without deleting and recreating them.
**Impact**: Chat updates are now event-driven and immediate. Local NLP model responses are faster. FAQ edits now correctly recalculate and store semantic vector embeddings.
**Files Changed**: `backend/package.json`, `backend/src/server.js`, `backend/src/app.js`, `backend/src/database.js`, `backend/src/services/smartResponder.js`, `backend/src/services/websocket.js`, `backend/src/routes/whatsapp-chat.js`, `backend/src/routes/knowledge-base.js`
**Tests**: Verified Socket.io connection and authentication locally. Verified `initModel` executes without errors. Verified `PUT` updates successfully recalculate embeddings.

- Installed `socket.io` and created `websocket.js` for JWT-authenticated real-time events.
- Integrated `initWebSocket` and NLP `initModel` into `server.js` startup lifecycle.
- Replaced HTTP polling reliance by emitting `chat_updated` via `emitToTenant` in webhooks and API routes.
- Modified `getTenantBySlug` to perform DB fallback on cache miss and improved `invalidateTenantCache` for granular invalidation.
- Updated `PUT /api/v1/knowledge-base/:id` to accept question/answer edits and re-calculate the `question_vector`.

## 2026-06-12 — Remove Google Gemini / OpenAI SDK and Finalize Local NLP Model Chatbot
**What**: Removed unused OpenAI SDK and Google Gemini API integration files and package dependencies.
**Why**: Pivoted to using the pure local semantic NLP model (`smartResponder.js`) running on the CPU using `@xenova/transformers`.
**Impact**: Removed third-party dependency `openai` and deprecated unused code, making the app fully self-contained.
**Files Changed**: `backend/package.json`, `backend/package-lock.json`, `backend/src/services/openai.js`, `knowledge-base/decisions.md`
**Tests**: Verified backend starts up cleanly and local NLP model remains fully operational.

- Deleted `backend/src/services/openai.js`.
- Uninstalled `openai` package and updated `package-lock.json`.
- Updated decisions documentation to reflect deprecation of Gemini API in favor of the local CPU-bound semantic NLP model.

## 2026-06-12 — Hotfix: Meta API audio/webm Content-Type Binary Validation Rejection
**What**: Integrated an FFmpeg-based transcoding pipeline on the backend to convert browser-recorded `audio/webm` buffers to native `audio/ogg` (Opus) containers.
**Why**: Meta's Graph API performs binary file structure validation. Renaming metadata MIME types is rejected as `application/octet-stream` if the binary structure is still WebM (EBML).
**Impact**: Voice notes recorded in the browser are correctly transcoded on the fly and sent successfully to Meta's API without binary validation errors.
**Files Changed**: `backend/src/routes/whatsapp-chat.js`, `backend/src/services/transcoder.js`
**Tests**: Verified syntax check.
**Commit**: `3b81130`

- Created `backend/src/services/transcoder.js` utilizing streaming `ffmpeg` stdin/stdout piping.
- Integrated `transcodeWebmToOgg` into the backend `send-media` route to convert recorded audio on the fly.

## 2026-06-12 — Hotfix: WhatsApp Chat Inbox Reference Errors
**What**: Restored browser voice recording states and handlers, and added native audio rendering to MediaMessage in Chat Inbox.
**Why**: The previous implementation was missing critical Javascript variable/handler definitions inside the `WhatsAppChat` component body and native audio tags in `MediaMessage`, causing runtime reference crashes that blocked opening chats.
**Impact**: Chat Inbox and conversation selection are fully operational again.
**Files Changed**: `frontend/src/components/WhatsAppChat.jsx`
**Tests**: Verified frontend builds successfully (`npm run build`).
**Commit**: `f2312e6`

- Implemented state variables (`isRecording`, `recordingTime`) and refs (`mediaRecorderRef`, `audioChunksRef`, `timerRef`) in `WhatsAppChat`.
- Added `startRecording`, `cancelRecording`, `stopAndSendRecording` handlers using the browser `MediaRecorder` API.
- Integrated standard `formatDuration(seconds)` utility for recording time representation.
- Added native `<audio>` element rendering to `MediaMessage` to correctly play sent voice notes.

## 2026-06-12 — Audio Recording and Store Timings Bot Control
**What**: Implemented voice note recording in Chat Inbox and store hours chatbot settings.
**Why**: Customers wanted to be able to record and send audio messages directly, and firms wanted to configure chatbot behaviors when customers message after-hours.
**Impact**: Chat inbox can now record and play voice messages; incoming after-hours messages trigger away actions like away message or silence based on configured hours.
**Files Changed**: `backend/src/app.js`, `backend/src/database.js`, `backend/src/routes/tenant-settings.js`, `backend/src/routes/whatsapp-chat.js`, `backend/src/services/whatsapp.js`, `frontend/src/components/Icons.jsx`, `frontend/src/components/Settings.jsx`, `frontend/src/components/WhatsAppChat.jsx`, `frontend/src/stores/store.js`
**Tests**: Verified frontend builds successfully (`npm run build`), backend syntax check (`node --check`) passes.
**Commit**: `c4e5d6a` (local changes to be committed)

- Added a new "Chatbot & Hours" settings tab to manage smart chatbot status, business hours timezone, open days, hours, and after-hours auto-responses.
- Updated incoming webhook message processor to intercept after-hours text messages and execute "Respond Normally", "Send Away Message", or "Remain Silent" rules.
- Added support for recording voice notes from the browser utilizing the MediaRecorder API, dispatches recorded audio blob to Meta's API, and displays native audio player controls in the Chat Inbox thread.
- Omitted caption parameter for audio media messages to satisfy Meta API schema validation constraints.

## 2026-06-12 — UI Redesign: Smart Knowledge Base FAQ Dashboard
**What**: Completely redesigned and overhauled the Smart Knowledge Base FAQ dashboard layout and styling.
**Why**: The previous UI had severe form field misalignment and squished inputs, making it look unprofessional.
**Impact**: Clean, premium aesthetic and fully responsive grid split-pane on desktop.
**Files Changed**: `frontend/src/components/KnowledgeBase.jsx`, `frontend/src/styles/main.css`, `frontend/package-lock.json`, `knowledge-base/active-context.md`, `knowledge-base/decisions.md`, `knowledge-base/known-issues.md`
**Tests**: Verified frontend builds successfully locally (`npm run build`). No automated test suites currently exist.
**Commit**: `93756b0`

- Implemented responsive split-column grid: Form on the left (max 480px), FAQ list on the right.
- Restructured form fields with `<div className="form-group">` wrappers, aligning labels and textareas vertically.
- Added interactive text input icons (magnifying glass, chat icons) and focus transition rings.
- Integrated a live horizontal Statistics panel showing Total FAQs, AI Status, and NLP Model metrics.
- Added dynamic search filtering in the Active FAQs list.
- Redesigned FAQ item cards with green brand left-accent, hover shadows, slide translation, and hover-triggered delete actions.

## 2026-06-12 — Feature: Send Media in WhatsApp Chat
**What**: Added the ability to send images and documents from the platform to WhatsApp users.
**Why**: Enhances the chat experience by allowing agents to send product images, invoices, and other media directly from the dashboard.
**Files Changed**: `backend/src/services/whatsapp.js`, `backend/src/routes/whatsapp-chat.js`, `frontend/src/stores/store.js`, `frontend/src/components/WhatsAppChat.jsx`
- Created `uploadMediaForMessage` service to proxy local file uploads to the Meta Graph API's `/media` endpoint.
- Added `POST /conversations/:id/send-media` endpoint using `multer` to handle `multipart/form-data` uploads.
- Updated `WhatsAppChat` UI with an attachment button (paperclip), image preview area, and caption support.

## 2026-06-12 — Fix: WhatsApp Media Message Display
**What**: Added secure backend proxy to fetch and render image messages sent from WhatsApp users to the SaaS Inbox.
**Why**: Meta requires authentication to fetch media URLs. The frontend could not directly display `<img>` tags without a bearer token, resulting in grey "📷 Image" placeholders.
**Files Changed**: `backend/src/routes/whatsapp-chat.js`, `frontend/src/stores/store.js`, `frontend/src/components/WhatsAppChat.jsx`
- Added `GET /api/v1/whatsapp/chat/media/:media_id` proxy endpoint in backend to securely download binary media from Meta API.
- Created `fetchMediaUrl` utility in frontend store to handle authenticated blob fetching.
- Added `MediaMessage` component to dynamically load and display images securely via `URL.createObjectURL`.

## 2026-06-12 — Feature: AI Chatbot Integration
**What**: Integrated an advanced AI auto-reply bot using Google Gemini's free `gemini-1.5-flash` model via the OpenAI SDK.
**Why**: Allows the platform to automatically respond to incoming customer messages for completely free without needing a paid OpenAI account.
**Files Changed**: `backend/src/services/openai.js`, `backend/src/app.js`, `backend/package.json`
- Installed `openai` npm package.
- Created `generateChatbotReply()` in `openai.js` that pulls the last 10 messages from the database to build conversation context and generates an AI response.
- Switched the SDK Base URL to `generativelanguage.googleapis.com/v1beta/openai/` to use Google's generous free tier.
- Integrated AI logic into `processIncomingMessage()` inside `app.js` to automatically reply to incoming text messages if `AI_API_KEY` is present.

## 2026-06-12 — Fix: Meta Commerce Catalog Sync for India
**What**: Added `origin_country` to the Meta Commerce API product sync payload
**Why**: Meta requires `origin_country` for catalogs in India. Without this field, products sync to the catalog but are hidden/rejected and do not display on the WhatsApp Business profile.
**Files Changed**: `backend/src/services/whatsapp.js`
- Added `origin_country: 'IN'` to the `PRODUCT_ITEM` `items_batch` payload.

## 2026-06-11 — Feature: Meta Commerce Catalog Integration
**What**: Automatically syncs locally created products to Meta Commerce Catalog via Graph API
**Why**: Ensures products added via the SaaS UI appear on the tenant's actual WhatsApp Business Profile in the WhatsApp app
**Files Changed**: `backend/src/database.js`, `backend/src/routes/tenant-settings.js`, `frontend/src/components/Settings.jsx`, `backend/src/services/whatsapp.js`, `backend/src/routes/products.js`
- Added `whatsapp_catalog_id` to tenants table and `meta_product_id` to products table
- Updated UI in Settings to allow entering Commerce Catalog ID
- Built `syncProductToMeta` to upsert products via `POST /<CATALOG_ID>/items_batch`
- Wired product create/update/delete API routes to sync to Meta in real-time

## 2026-06-11 — Feature: Product Catalogue
**What**: Added Product Catalogue functionality to allow tenants to manage products.
**Why**: Tenants need a way to manage their product catalogue before creating WhatsApp catalog messages or broadcast templates involving products.
**Files Changed**: `backend/src/routes/products.js`, `backend/src/database.js`, `backend/src/app.js`, `frontend/src/App.jsx`, `frontend/src/components/Sidebar.jsx`, `frontend/src/components/Catalogue.jsx`
- Backend: Added `products` table migration in `database.js`
- Backend: Added full CRUD API (`GET`, `POST`, `PUT`, `DELETE` on `/api/v1/products`) scoped by `tenant_id`
- Frontend: Added `Catalogue.jsx` component with a responsive grid layout
- Frontend: Added modal for creating/editing products with fields for Name, Description, MRP, Selling Price, Category, SKU, and Image URL
- Frontend: Added new 'Catalogue' item to `Sidebar.jsx` and registered route in `App.jsx`

## 2026-04-27 — Feature: Template Edit Functionality
**What**: Added ability to edit existing WhatsApp templates from the Templates tab
**Why**: Users previously had to delete and recreate templates to make changes — now they can edit body, footer, buttons, and header image directly
**Files Changed**: `backend/src/services/whatsapp.js`, `backend/src/routes/whatsapp.js`, `frontend/src/stores/store.js`, `frontend/src/components/WhatsAppBroadcast.jsx`
- Backend: Added `editTemplate()` service function that calls Meta's `POST /{template_id}` API to update template components
- Backend: Added `PUT /api/v1/whatsapp/templates/:id` route that accepts updated body/footer/buttons/image and forwards to Meta API, also updates local DB record
- Frontend Store: Added `editWhatsAppTemplate` Zustand action
- Frontend UI: "Edit" button in template list table opens a full-screen modal with:
  - Read-only display of name, category, language (Meta doesn't allow changing these)
  - Editable body text, footer, header image, and button builder
  - Live WhatsApp-style preview panel (matches the create template preview)
  - Pre-fills all fields from the existing template's Meta component data
  - On save, resubmits template to Meta for review and shows success toast
- Invalidates template definition cache after edit to ensure fresh data

---

## 2026-04-22 — Fix: Message Timestamps Showing in UTC
**What**: Fixed chat messages and conversation list timestamps showing UTC time instead of local time
**Why**: Database timestamps are stored in UTC without timezone markers, so the frontend interpreted them as local time before formatting
**Files Changed**: `frontend/src/components/WhatsAppChat.jsx`
- Added `parseUTC` helper to append `Z` to timestamp strings from the backend
- This forces the JavaScript `Date` object to parse it as UTC rather than local time
- `toLocaleTimeString` and `toLocaleDateString` now correctly convert the UTC time to the user's local timezone (e.g., IST)
- Applied to both the conversation list timestamps and the individual message timestamps

---

## 2026-04-22 — Fix: Messages & Replies Not Showing in Chat Inbox
**What**: Fixed chat inbox not displaying new messages or customer replies
**Why**: Stale JavaScript closure bug — the polling setInterval captured the initial null value of selectedConvId, so message polling NEVER ran after the initial click
**Files Changed**: `frontend/src/components/WhatsAppChat.jsx`, `backend/src/app.js`, `backend/src/routes/whatsapp-chat.js`
- Root Cause: `useEffect` with `[]` dependency meant `selectedConvId` was always `null` inside the interval callback (React stale closure)
- Fix: Use refs (`selectedConvIdRef`, `searchRef`) that stay in sync with state, so the interval always reads current values
- Polling now restarts when conversation changes for immediate responsiveness
- Added detailed webhook logging to trace incoming message processing
- Added messages API endpoint logging to help debug empty message responses

---

## 2026-04-17 — Feature: Rich Template Cards in Chat Inbox
**What**: Template messages now display as full WhatsApp-style cards with header image, body, footer, and buttons
**Why**: Previously showed only `[Template: n1]` or plain body text — users couldn't see the complete message sent to customers
**Files Changed**: `backend/src/routes/whatsapp-chat.js`, `backend/src/services/whatsapp.js`, `frontend/src/components/WhatsAppChat.jsx`
**Commit**: `9a584bc`
- Backend `resolveTemplateBody()` now stores rich JSON with all template components (header, body, footer, buttons)
- `getTemplatePlainText()` extracts plain text for sidebar conversation preview
- Frontend `TemplateCard` component renders WhatsApp-style cards with:
  - Header images (IMAGE), video placeholders, document icons, text headers
  - Body text with variables filled in
  - Footer text
  - Styled buttons (phone, URL, quick reply) with icons
- Backward compatible: old `[Template: name]` format messages still render as before
- Only new messages after deploy get the rich card format

---

## 2026-04-15 — Fix: Broadcast Messages Not Sending (All Campaigns Failed)
**What**: Fixed broadcasts showing 0 sent / 0 failed / status "Failed"
**Why**: `processBroadcast` background function crashed before sending messages; error was hidden from UI
**Files Changed**: `backend/src/routes/whatsapp.js`, `backend/src/database.js`, `frontend/src/components/WhatsAppBroadcast.jsx`
**Commit**: `4c63172`
- Reload tenant from DB in `processBroadcast` instead of using potentially stale cache object
- Show `error_log` in campaign history table and campaign detail modal
- Added step-by-step console.log in `processBroadcast` for server-side debugging
- Added missing `buttons_json` column to `whatsapp_templates` table migration
- Wrapped the catch block's DB update in its own try/catch to prevent silent failures

## 2026-04-15 — Feature: Start New Chat from Inbox
**What**: Added ability to start new WhatsApp conversations from the Chat Inbox
**Why**: Chat Inbox had no way to initiate conversations — only showed replies to broadcasts
**Files Changed**: `backend/src/routes/whatsapp-chat.js`, `frontend/src/components/WhatsAppChat.jsx`, `frontend/src/stores/store.js`
**Commit**: `d75c69c`
- Green "+" button next to search bar to start new conversation
- Two-step modal: (1) Enter phone or select from contacts list (2) Pick template + fill variables
- WhatsApp-style inline preview of template before sending
- Backend `POST /conversations/new` creates/finds conversation, sends template, stores message
- "Start New Chat" CTA button shown when conversation list is empty
- Contact search with hover effects and arrow icon

## 2026-04-15 — Fix: LIMIT/OFFSET Prepared Statement in Chat
**What**: Fixed `ER_WRONG_ARGUMENTS` crash in chat conversations and messages queries
**Why**: MySQL `pool.execute()` doesn't support `?` placeholders for LIMIT/OFFSET
**Files Changed**: `backend/src/routes/whatsapp-chat.js`
**Commit**: `0ea06a5`
- Inlined LIMIT and OFFSET as `parseInt()` values in both conversation list and message list queries

## 2026-04-14 — Admin Panel for Tenant Management
**What**: Added super admin panel to manage user accounts (temporary dev tool)
**Why**: Need to upgrade/suspend/delete tenants during development without direct DB access
**Files Changed**: `backend/src/routes/admin.js` [NEW], `frontend/src/components/AdminPanel.jsx` [NEW], `backend/src/app.js`, `frontend/src/App.jsx`, `frontend/src/components/Sidebar.jsx`
**Commit**: `b958740`
- Backend: GET/PUT/DELETE /api/v1/admin/tenants endpoints protected by `superAdminOnly` middleware
- Frontend: Card-based UI with inline edit for plan/status, suspend toggle, delete with confirmation
- View users per tenant in expandable section
- Sidebar shows "Admin Panel" link only for users with `role === 'admin'`
- Backend enforces `SUPER_ADMIN_EMAILS` env var — must be set on server
- Default tenant (id=1) cannot be deleted

## 2026-04-11 — MySQL LIMIT/OFFSET Prepared Statement Fix
**What**: Fixed contacts GET endpoint crashing with `ER_WRONG_ARGUMENTS` (errno 1210)
**Why**: MySQL `pool.execute()` uses server-side prepared statements which don't support `LIMIT ?` or `OFFSET ?` as placeholders
**Files Changed**: `backend/src/routes/contacts.js`
**Commit**: `27dcc88`
- Inlined LIMIT and OFFSET as `parseInt()` values instead of `?` placeholders
- This was the root cause of "imported contacts not visible" — the GET always crashed silently
- All imports were actually succeeding (verified via debug logs)

## 2026-04-11 — Tenant Auth System Overhaul (3 commits)
**What**: Fixed "Account not found" and "Invalid credentials" errors on login/logout/new-device
**Why**: Single-domain SaaS (`broadcast.innodify.in`) was being treated as subdomain-based multi-tenant
**Files Changed**: `backend/src/middleware/tenant.js`, `backend/src/middleware/auth.js`, `backend/src/routes/auth.js`, `frontend/src/stores/store.js`
**Commits**: `2c6f0a8`, `3c72a5f`, `e841410`
- **Frontend** `getTenantSlug()`: Recognizes `broadcast`, `app`, `www`, `api`, `admin` as app domains (not tenants)
- **Backend** `resolveTenant`: Made "soft" — if slug not found, passes with `null` instead of blocking with 404
- **Backend** `auth` middleware: Now loads tenant from JWT `tenantId` when tenant middleware didn't resolve
- **Backend** login route: Searches by email across ALL tenants (not scoped to `req.tenantId`)
- Added final check: rejects if no `tenantId` from either slug or JWT

## 2026-04-11 — CSV File Upload Import (Contacts)
**What**: Replaced text-paste import modal with proper CSV file upload
**Why**: Users need to upload CSV files, not paste raw text
**Files Changed**: `frontend/src/components/Contacts.jsx`, `frontend/src/stores/store.js`
**Commit**: `0cad430`
- Click-to-upload area with dashed border UI
- Parses CSV with header detection (skips row if contains "name"+"phone")
- Preview table showing first 5 rows before import
- "Download Template" button inside modal
- Template button in header downloads `contacts_import_template.csv`
- `importContacts` now `await`s `fetchContacts()` for guaranteed refresh

## 2026-04-10 — Comprehensive Responsive Adaptation
**What**: Full responsive overhaul for tablet (1024px) and mobile (768px)
**Why**: All component grids used inline `style={{}}` which CSS media queries couldn't override
**Files Changed**: `frontend/src/styles/main.css`, `frontend/src/components/WhatsAppChat.jsx`, `frontend/src/components/Icons.jsx`
**Commit**: `2c31e9c`
- Added tablet breakpoint (≤1024px) and expanded mobile breakpoint (≤768px)
- CSS attribute selectors override inline grids: `[style*="1fr 1fr 1fr"]`, `[style*="1fr 340px"]`
- Chat inbox: mobile shows list/chat toggle with ← back button
- 44px min touch targets, 16px font inputs (prevents iOS zoom)
- Added `arrow-left` icon to icon system

## 2026-04-10 — WhatsApp Button Types Support
**What**: Template builder now supports all WhatsApp button types (Call, URL, Quick Reply)
**Why**: Previously only supported call buttons; Meta allows URL and Quick Reply too
**Files Changed**: `backend/src/services/whatsapp.js`, `backend/src/routes/whatsapp.js`, `frontend/src/components/WhatsAppBroadcast.jsx`
**Commit**: `21db69f`
- Dynamic button builder UI: + Call, + Website, + Quick Reply
- Auto-disables at Meta limits (1 call, 2 URL)
- Backend `createTemplate` accepts generic `buttons[]` array
- Live preview renders all button types with correct WhatsApp icons
 
 
