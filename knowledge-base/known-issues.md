# Known Issues

A registry of active bugs, limitations, and workarounds.

## ISSUE-029: Labeled Broadcast Regression Test Was Too Specific
**Status**: Resolved
**Severity**: Low
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: The backend regression suite failed on current upstream `main` before new chat work started, even though the labeled-broadcast route still filtered by `recipientFilter.label`.
**Root Cause**: The static assertion expected a `labels: { ... }` object-literal shape, but the Mongo route now assigns `baseFilter.labels = { $regex: new RegExp(recipientFilter.label, 'i') }`.
**Workaround**: None needed after this fix.
**Fix**: Updated the regression assertion to match the current Mongo query assignment without weakening the labeled-filter contract.
**Regression Test**: `backend/test/regression.test.js` test `labeled broadcasts are supported by the campaign schema and route`.

## ISSUE-028: Chat Inbox Needed Manual Refresh On Vercel
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: Operators had to refresh the Vercel page to see newly arrived messages or updated conversation state in Chat Inbox.
**Root Cause**: The Chat Inbox had removed polling and depended on Socket.IO refresh events. Vercel serverless functions cannot be treated as a reliable long-lived Socket.IO host for this deployment.
**Workaround**: None needed after this fix. Before the fix, manually refresh the page to see new messages.
**Fix**: Added a lightweight 5-second polling fallback while Chat Inbox is mounted, plus immediate refresh on window focus and tab visibility return.
**Regression Test**: `backend/test/regression.test.js` test `Chat Inbox has a polling fallback when Vercel sockets are unavailable`.

## ISSUE-027: Support Feedback Replies Fell Through To Smart Automation
**Status**: Resolved
**Severity**: Medium
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: After a support chat was resolved, tapping Good or Bad feedback on WhatsApp could trigger an unrelated Smart Automation reply such as the welcome text.
**Root Cause**: The webhook displayed button replies as inbound messages but had no terminal support-feedback branch for `feedback_good` or `feedback_bad`, so those replies continued into the normal automation pipeline.
**Workaround**: None needed after this fix. Before the fix, avoid using feedback buttons on live chats if unrelated bot replies are unacceptable.
**Fix**: Added `supportFeedback.js`, parsed stable feedback button IDs, stored `bot_state.last_support_feedback`, sent "Thank you for your feedback.", emitted `support_feedback_received`, and skipped Smart Automation for that webhook message.
**Regression Test**: `backend/test/regression.test.js` test `support feedback button replies are acknowledged without Smart Automation`.

## ISSUE-026: Unmatched Messages Needed Confirmation Before Human Handoff
**Status**: Resolved
**Severity**: Medium
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: When Smart Automation did not understand a customer message, the flow either left the customer with no recovery prompt or could escalate to a human-style handoff without an explicit customer confirmation.
**Root Cause**: The webhook had no dedicated unknown-message confirmation state. Unanswered messages were only logged for learning, while handoff state was reserved for Smart Flow handoff replies.
**Workaround**: None needed after this fix.
**Fix**: Added a Yes/No confirmation prompt for no-match replies, persisted the pending prompt in `conversation.bot_state.awaiting_human_confirmation`, and moved `needs_human`/`bot_paused` escalation behind a Yes response.
**Regression Test**: `backend/test/regression.test.js` test `Smart Automation asks before escalating unmatched messages to a human`.

## ISSUE-025: Duplicate Resolve Actions Sent Two Feedback Requests
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: A handoff chat could show both the Needs Human resolve action and the green Resolve Chat action. Clicking both sent duplicate "support chat resolved" feedback requests to the customer on WhatsApp.
**Root Cause**: `WhatsAppChat.jsx` rendered the generic bot-paused Resolve Chat button whenever `bot_paused` was true, even if `needs_human` was also true. The backend bot-pause route also sent feedback on any `send_feedback && !paused` request, so stale UI or repeated requests could send another feedback message.
**Workaround**: None needed after this fix. Before the fix, operators had to avoid the green Resolve Chat button when Needs Human was active.
**Fix**: Hide Resolve Chat while `needs_human` is active, require handoff conversations to use Resolve Handoff, and only send support feedback from bot-pause if the conversation was actually paused before the request.
**Regression Test**: `backend/test/regression.test.js` test `Chat Inbox exposes one feedback-sending resolve action for handoffs`.

## ISSUE-024: Chat Inbox Commerce Filters Missing From Mongo Fork
**Status**: Resolved
**Severity**: Medium
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: Narmada Chat Inbox still used the older All/Unread/Paid/Needs Human tab layout and could not filter unpaid hosted-checkout orders or abandoned carts from the server.
**Root Cause**: Main-platform commit `3f088251462d3ae1210bfcfe3d13f0bb612cab7d` implemented the feature against SQL tables, while the Narmada fork uses Mongo models. The Narmada `Order` schema also lacked an explicit `tenant_id` field even though checkout code wrote one.
**Workaround**: None needed after this fix.
**Fix**: Added Mongo order-status phone-set filters, server-side filter counts, per-conversation commerce flags, compact dropdown UI, unpaid/abandoned chips, and `Order.tenant_id` with single-client defaults plus compatibility for older order documents.
**Regression Test**: `backend/test/regression.test.js` test `Chat Inbox filters commerce-status conversations through Mongo order state`.

## ISSUE-023: Chat Inbox Rendered Mongo Timestamps As Invalid Date
**Status**: Resolved
**Severity**: Medium
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: The live Chat Inbox showed `Invalid Date` in conversation rows, message bubbles, and date separators.
**Root Cause**: `WhatsAppChat.jsx` appended `Z` to every timestamp after replacing spaces with `T`. That worked for legacy SQL-style UTC strings, but Mongo/Mongoose sends ISO strings that already include `T` and `Z`, producing invalid `...ZZ` date strings.
**Workaround**: None needed after this fix.
**Fix**: Added `frontend/src/utils/chatDates.js` to parse Mongo ISO strings, legacy SQL-style UTC strings, Date objects, and invalid values safely. `WhatsAppChat.jsx` now uses the shared helpers and the main-platform compact header styling.
**Regression Test**: `backend/test/regression.test.js` test `Chat Inbox keeps the compact header polish and formats Mongo ISO dates safely`.

## ISSUE-022: Resolve Handoff PATCH Route Missing On Vercel
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: Clicking Resolve Handoff in the live Chat Inbox showed a red toast containing an HTML Express error like `Cannot PATCH /api/v1/whatsapp/chat/conversations/:id/handoff/resolve`.
**Root Cause**: The Narmada frontend had the main-platform Chat Inbox handoff and teach actions, but the Mongo/Vercel backend route file only implemented bot pause. The backend also ignored the `needs_human=1` inbox filter used by the frontend.
**Workaround**: None needed after this fix. Before this fix, agents could use the bot pause resume action for some conversations, but the Resolve Handoff modal itself stayed broken.
**Fix**: Added `PATCH /api/v1/whatsapp/chat/conversations/:id/handoff/resolve`, added `POST /api/v1/whatsapp/chat/conversations/:id/teach`, restored server-side `needs_human=1` filtering, and documented the Chat Inbox route contract.
**Regression Test**: `backend/test/regression.test.js` test `Chat Inbox handoff resolution and teach actions have backend routes matching the frontend contract`.

## ISSUE-021: No-Order Smart Flow Could Bypass FAQ Answers
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: A customer asking an order/delivery/payment-style question could receive the human-handoff text when their WhatsApp number had no order, even if the client had a matching Smart FAQ.
**Root Cause**: `handleSmartReply()` returned any Smart Flow reply immediately. The `order_status` Smart Flow emits a `handoff` with `reason: 'order_not_found'`, so FAQ/product retrieval did not get a chance to answer.
**Workaround**: None needed after this fix. Before this fix, broad delivery/payment FAQs could be shadowed by the no-order status flow.
**Fix**: `smartResponder.js` now defers only `order_not_found` handoffs, tries retrieval v2 and legacy FAQ/product matching, and returns the deferred handoff only if retrieval cannot answer.
**Regression Test**: `backend/test/regression.test.js` test `Smart Automation tries FAQ retrieval before no-order human handoff`.

## ISSUE-020: Vercel Transformer Cache Tried To Write Under Read-Only Bundle
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: Switching Settings -> Automation & Hours to the multilingual E5 model on `https://narmada-broadcast-8vox.vercel.app/` showed `ENOENT: no such file or directory, mkdir '/var/task/backend/node_modules/@huggingface...'`.
**Root Cause**: Transformers.js defaults its filesystem cache to a package-local `.cache` directory. On Vercel, `/var/task` is the deployed bundle and is read-only, so model downloads could not create cache folders there.
**Workaround**: None needed after this fix. If a non-Vercel host needs a custom writable location, set `TRANSFORMERS_CACHE_DIR`.
**Fix**: `backend/src/services/smartResponder.js` now sets `env.cacheDir` to `process.env.TRANSFORMERS_CACHE_DIR || path.join(os.tmpdir(), 'narmada-transformers-cache')` before any `pipeline()` model load.
**Regression Test**: `backend/test/regression.test.js` asserts the Smart Responder configures a writable Transformers cache for serverless deploys.

## ISSUE-019: Vercel Fork Drifted Into External Provider Smart Automation
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-07-02
**Resolved**: 2026-07-02
**Symptom**: The Vercel deployment repair path made Smart Automation appear to require or benefit from a provider key, and active UI/docs still used AI Assistant wording. This conflicted with the main WhatsApp Broadcast platform contract, where automation is local and self-contained.
**Root Cause**: The coworker-created fork had accumulated mixed frontend/backend automation naming and a Gemini embedding implementation while being adapted to MongoDB/Vercel.
**Workaround**: None needed after this fix. Before redeploy, do not add any provider key in Vercel for Smart Automation.
**Fix**: Replaced the provider embedding call with local `@huggingface/transformers` feature extraction, moved Settings routes to `/smart-automation/*`, updated FAQ/product/re-embed vector tagging to use local model keys, renamed active product-facing UI copy, and removed provider-key guidance from active docs.
**Regression Test**: `backend/test/regression.test.js` covers Smart Automation route contracts and fails if active source/product docs reintroduce provider-key wording.

## ISSUE-018: Narmada Vercel Fork Had Mongo Isolation And Chatbot Route Drift
**Status**: Resolved
**Severity**: Critical
**Discovered**: 2026-07-01
**Resolved**: 2026-07-01
**Symptom**: The independent Vercel deployment loaded stale authenticated state in the browser, Settings/AI Assistant/Knowledge Base calls returned 404s, FAQ list responses did not match the frontend contract, and the chatbot could not reliably answer when embeddings or `AI_API_KEY` were missing.
**Root Cause**: The fork had drifted from the reference frontend contracts after moving to MongoDB/Vercel. It also retained a hardcoded MongoDB Atlas fallback URI, which risked connecting the client product to a shared/exposed database instead of a client-owned database.
**Workaround**: Before the fix, manually setting the correct MongoDB env vars and clearing browser site data could reduce symptoms, but missing backend routes still broke the UI.
**Fix**: Removed the hardcoded MongoDB fallback, required `MONGO_URI` in production/Vercel, added `/auth/me` validation and product-specific auth storage, implemented AI Assistant/embedding/Knowledge Base test/phrasings routes, returned `{ faqs }` from Knowledge Base list, added lexical matching fallback, updated Vercel deployment docs, and removed the unused vulnerable mailer dependency.
**Regression Test**: `backend/test/regression.test.js` covers env-only Mongo, `/auth/me`, AI Assistant routes, Knowledge Base contracts, lexical fallback, audit dependency removal, and deployment doc placeholders.

## ISSUE-017: whatsappTemplates.filter TypeError Crashes Broadcast & Chat
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-06-24
**Resolved**: 2026-06-24
**Symptom**: Opening the Broadcast or Chat Inbox pages throws `Uncaught (in promise) TypeError: (whatsappTemplates || []).filter is not a function` repeatedly in the console, preventing template selection and broadcast functionality.
**Root Cause**: The `fetchWhatsAppTemplates` store function set `whatsappTemplates` directly from the API response without verifying it was an array. If the API returned an object (e.g., `{ data: [...] }` or an error shape), the `|| []` fallback in consumers only caught falsy values, not truthy non-array objects. Additionally, the catch block didn't reset the state to `[]`.
**Workaround**: None needed.
**Fix**: Made `fetchWhatsAppTemplates` in `store.js` defensive with `Array.isArray` checks and `response.data` fallback. Updated all consumers in `WhatsAppBroadcast.jsx` and `WhatsAppChat.jsx` to use `Array.isArray` guard instead of `|| []`.


## ISSUE-001: MySQL LIMIT/OFFSET Prepared Statement Failures
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-04-11
**Resolved**: 2026-04-11
**Symptom**: Contacts and Chat Inbox endpoints fail with `ER_WRONG_ARGUMENTS` when trying to fetch paginated datasets.
**Root Cause**: Node.js `mysql2` `pool.execute()` creates prepared statements on the MySQL server, which does not allow placeholders `?` in `LIMIT` and `OFFSET` clauses.
**Workaround**: None needed.
**Fix**: Inline parsed integer variables into the query strings directly.

## ISSUE-002: Smart FAQs Layout Misalignment
**Status**: Resolved
**Severity**: Medium
**Discovered**: 2026-06-12
**Resolved**: 2026-06-12
**Symptom**: In the Smart Knowledge Base view, the "Add New FAQ" form layout is misaligned. Labels are placed inline next to input fields, inputs are squished, textareas overlap, and buttons float awkwardly.
**Root Cause**: The component uses generic `<div>` wrappers instead of `<div className="form-group">`, and does not follow the flexbox structure defined in `main.css`.
**Workaround**: Users can still interact with the form, but it looks unprofessional.
**Fix**: Overhauled the form and FAQ cards styling in `KnowledgeBase.jsx` to use proper layout groups, flex containers, and aligned elements.

## ISSUE-003: Public Debug Endpoint Exposes Tenant and Chat Metadata
**Status**: Resolved
**Severity**: Critical
**Discovered**: 2026-06-16
**Resolved**: 2026-06-16
**Symptom**: Anyone who can reach `/api/v1/debug/chat-status` can retrieve tenant identifiers, WhatsApp phone number IDs, recent conversations, recent message previews, webhook event logs, and the webhook verify token.
**Root Cause**: `backend/src/app.js` registers the diagnostic endpoint before tenant/auth middleware and intentionally leaves it public.
**Workaround**: None needed.
**Fix**: Removed the public debug endpoint from `backend/src/app.js`.
**Regression Test**: `backend/test/regression.test.js` asserts the `chat-status` debug route is not registered.

## ISSUE-004: Razorpay Webhook Does Not Verify Signatures
**Status**: Resolved
**Severity**: Critical
**Discovered**: 2026-06-16
**Resolved**: 2026-06-16
**Symptom**: A forged request to `/api/v1/razorpay-webhook` can mark an order as paid if it contains a matching `order_id` note.
**Root Cause**: The route reads the `x-razorpay-signature` header but does not compute or compare an HMAC with the tenant webhook secret before updating the order.
**Workaround**: None needed.
**Fix**: Captured raw JSON request bodies, added timing-safe Razorpay HMAC verification in `backend/src/utils/security.js`, required each tenant's stored webhook secret before marking orders paid, and tenant-scoped the pending order lookup/update.
**Regression Test**: `backend/test/regression.test.js` covers valid, invalid, and missing Razorpay signatures.

## ISSUE-005: Label Broadcasts Are Blocked by Campaign Enum
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-06-16
**Resolved**: 2026-06-16
**Symptom**: Broadcasts with `recipientType: 'labeled'` fail when inserting the campaign record on schemas where `whatsapp_campaigns.recipient_type` still only allows `all`, `tagged`, and `custom`.
**Root Cause**: `backend/src/routes/whatsapp.js` accepts the new `labeled` recipient type, but `backend/src/database.js` does not create or migrate the enum to include `labeled`.
**Workaround**: None needed.
**Fix**: Updated the base schema and migration list in `backend/src/database.js` so `whatsapp_campaigns.recipient_type` includes `labeled`.
**Regression Test**: `backend/test/regression.test.js` asserts the schema and migration include the `labeled` enum value.

## ISSUE-006: Open Chat Thread Does Not Refresh on Realtime Events
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-06-16
**Resolved**: 2026-06-16
**Symptom**: Incoming messages and bot replies refresh the conversation list but do not refresh the currently open chat thread via Socket.io.
**Root Cause**: Backend emits `conversationId`, while the frontend socket handler checks `data.conversation_id`.
**Workaround**: None needed.
**Fix**: Updated the frontend socket handler in `frontend/src/stores/store.js` to accept both `conversationId` and `conversation_id`.
**Regression Test**: `backend/test/regression.test.js` statically asserts the store handles the backend `conversationId` event key.

## ISSUE-007: Bot Pause Toggle Is UI-Only
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-06-16
**Resolved**: 2026-06-16
**Symptom**: Agents can toggle the pause/play button in Chat Inbox, but the backend smart responder continues to auto-reply to inbound customer messages.
**Root Cause**: Paused conversation IDs are stored only in browser localStorage; the webhook auto-reply path never checks a persisted pause flag.
**Workaround**: None needed.
**Fix**: Added `whatsapp_conversations.bot_paused`, persisted pause state through `PATCH /whatsapp/chat/conversations/:id/bot-pause`, updated the frontend store/chat UI to use server state, and made the inbound webhook skip auto-replies for paused conversations.
**Regression Test**: `backend/test/regression.test.js` asserts the schema, route, frontend store, and webhook pause check exist.

## ISSUE-008: Razorpay Secrets Are Rehydrated Into Settings Form
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-06-16
**Resolved**: 2026-06-16
**Symptom**: Razorpay key secret and webhook secret can be returned inside `bot_settings` and repopulated into password fields after settings reload.
**Root Cause**: `GET /api/v1/tenant-settings` masks WhatsApp access tokens but returns `bot_settings` unchanged; the frontend parses that JSON directly into secret-bearing form state.
**Workaround**: None needed.
**Fix**: Added settings sanitization helpers that blank Razorpay secret values on reads, expose boolean `has_*` flags, and preserve stored secrets when updates submit blank secret fields.
**Regression Test**: `backend/test/regression.test.js` covers masking and blank-secret merge behavior.

## ISSUE-009: Frontend Lint Gate Is Red
**Status**: Resolved
**Severity**: Medium
**Discovered**: 2026-06-16
**Resolved**: 2026-06-16
**Symptom**: `npm run lint` in `frontend/` exits with 11 errors and 37 warnings.
**Root Cause**: Current violations include conditional hooks in `Catalogue.jsx`, unescaped JSX text, missing hook dependencies, unused variables, and image accessibility warnings.
**Workaround**: None needed.
**Fix**: Added local ESLint configuration/dependency, moved `Catalogue.jsx` hooks before early returns, and cleaned unused frontend bindings so the lint gate is deterministic and green.
**Regression Test**: `npm run lint` from `frontend/` exits 0.

## ISSUE-010: Deployment Documentation Contains Production-Looking Secrets
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-06-16
**Resolved**: 2026-06-16
**Symptom**: `knowledge-base/DEPLOYMENT.md` includes concrete-looking database, JWT, and webhook secret values in example production commands.
**Root Cause**: Deployment instructions were written with real-looking values instead of placeholders or secret-manager references.
**Workaround**: Rotate any copied values if they were ever used outside documentation examples.
**Fix**: Replaced concrete-looking deployment secrets with placeholders in `knowledge-base/DEPLOYMENT.md`.
**Regression Test**: `backend/test/regression.test.js` checks the deployment docs use placeholders, and the targeted `rg` secret-pattern scan returns no matches.

## ISSUE-011: Dependency Audit Finds High/Critical Vulnerabilities
**Status**: Resolved
**Severity**: Critical
**Discovered**: 2026-06-16
**Resolved**: 2026-06-16
**Symptom**: `npm audit --audit-level=high` reported vulnerable frontend and backend dependency chains including Preact, Vite/esbuild, Socket.io/ws, Nodemailer, Express/path-to-regexp/qs, and `@xenova/transformers` through old ONNX/protobuf packages.
**Root Cause**: Lockfiles had drifted to vulnerable transitive versions, and the deprecated `@xenova/transformers` package pinned an old ONNX runtime.
**Workaround**: None needed.
**Fix**: Ran non-forced audit fixes, upgraded Vite to 8, added an npm `ws` override to 8.21.0, and migrated local semantic embeddings from `@xenova/transformers` to `@huggingface/transformers`.
**Regression Test**: `npm audit --audit-level=high` from both `frontend/` and `backend/` exits 0.

## ISSUE-012: Razorpay Webhook Signature Bypass Regression
**Status**: Resolved
**Severity**: Critical
**Discovered**: 2026-06-17
**Resolved**: 2026-06-17
**Symptom**: A tenant without a configured Razorpay webhook secret could still have payment webhook processing continue without a verified signature.
**Root Cause**: A remote change made the signature requirement optional for backward compatibility, which reopened the forged payment update path.
**Workaround**: None needed.
**Fix**: Reject Razorpay webhook requests with HTTP 400 when the tenant webhook secret is missing, and keep invalid signatures rejected before any order update.
**Regression Test**: `backend/test/regression.test.js` asserts the route rejects missing webhook-secret processing and does not log/continue unsigned webhooks.

## ISSUE-013: Product Uploads Accepted Non-Image Files
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-06-17
**Resolved**: 2026-06-17
**Symptom**: Product catalogue upload routes could accept arbitrary files and serve them publicly from the uploads directory.
**Root Cause**: The product upload middleware used disk storage without a MIME type and extension allowlist.
**Workaround**: None needed.
**Fix**: Added image MIME and file-extension validation, safe upload names, upload error handling, and kept the single-image route for backward compatibility.
**Regression Test**: `backend/test/regression.test.js` asserts image MIME/type validation and the `/upload-image` route contract.

## ISSUE-014: Mobile App Shell and Orders Table Were Not Phone-Friendly
**Status**: Resolved
**Severity**: Medium
**Discovered**: 2026-06-17
**Resolved**: 2026-06-17
**Symptom**: Store owners on phone widths needed a reliable drawer navigation flow and a scannable Orders view instead of a desktop table surface.
**Root Cause**: The responsive shell relied on matching drawer state classes, and Orders only had a desktop table presentation.
**Workaround**: None needed.
**Fix**: Standardized the `sidebar--open` drawer class contract, added mobile Orders cards, and verified the flows in the in-app browser at 390px width.
**Regression Test**: `backend/test/regression.test.js` statically asserts the mobile drawer and Orders mobile-card contracts.

## ISSUE-015: Interactive Shopping Flow Overrode Smart FAQ Replies
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-06-17
**Resolved**: 2026-06-17
**Symptom**: Any inbound text message could trigger the Blouses/Shapewear interactive prompt and return before the normal Smart FAQ/product responder ran.
**Root Cause**: The interactive shopping flow was inserted before the Smart Responder branch and used a broad `messageType === 'text'` condition.
**Workaround**: None needed.
**Fix**: Kept catalogue button replies, but gated free-text shopping prompts behind bot automation being enabled and explicit product/category intent keywords.
**Regression Test**: `backend/test/regression.test.js` asserts the shopping flow is intent-gated and no longer contains the broad "any text" override.

## ISSUE-016: Coworker Support Flow Regressions
**Status**: Resolved
**Severity**: High
**Discovered**: 2026-06-17
**Resolved**: 2026-06-17
**Symptom**: The pulled support-flow batch made every inbound customer text trigger the generic shop/support menu, cancel-order button payloads were scoped only by tenant/order ID, and call-request support could send a placeholder `+919876543210` contact card.
**Root Cause**: The text-intent guard was broadened to `messageType === 'text'`, order cancellation queries did not include the requesting WhatsApp phone number, and the support call path used a hardcoded fallback instead of requiring a configured tenant support phone.
**Workaround**: None needed.
**Fix**: Restored explicit product/category intent keywords for free-text shopping prompts, scoped cancellation lookup/update by `tenant_id` and `phone`, added safe no-order/no-update responses, and replaced the placeholder support number with a tenant-phone-required path.
**Regression Test**: `backend/test/regression.test.js` asserts shopping prompts are intent-gated, cancel-order SQL is phone-scoped, recent support orders are phone-scoped, and the placeholder support number is absent.
