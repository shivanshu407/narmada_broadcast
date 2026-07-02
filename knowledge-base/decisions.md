# Architectural Decisions

This document logs the architectural choices made during the development of the WhatsApp Broadcast SaaS.

## Decision: Support Feedback Replies Are Terminal Webhook Events
**Date**: 2026-07-02
**Status**: Accepted
**Context**: Resolve Handoff and Resolve Chat send WhatsApp Good/Bad feedback buttons. Those button replies are customer support ratings, not new product or FAQ questions.
**Decision**: Parse only stable feedback button IDs (`feedback_good` and `feedback_bad`) before Smart Automation. Store the rating in `conversation.bot_state.last_support_feedback`, send a thank-you text, emit a chat refresh event, and stop webhook processing for that message.
**Alternatives Considered**: Let Smart Automation answer feedback replies, parse typed "Good"/"Bad" text as feedback, or ignore feedback entirely. Automation replies are wrong for terminal support ratings. Typed text parsing risks false positives. Ignoring feedback gives the customer no acknowledgement.
**Consequences**: Support ratings no longer create unrelated bot replies. Future feedback analytics can read `bot_state.last_support_feedback`; richer analytics may need a dedicated collection if historical reporting becomes important.
**Superseded By**:

## Decision: Chat Inbox Uses Polling Fallback On Vercel
**Date**: 2026-07-02
**Status**: Accepted
**Context**: Chat Inbox realtime events worked only when Socket.IO stayed connected. The Narmada deployment runs on Vercel serverless functions, where long-lived sockets are unreliable for this product shape.
**Decision**: Keep existing websocket refresh support, but add a lightweight frontend polling fallback while `WhatsAppChat.jsx` is mounted. Poll every 5 seconds, skip hidden tabs, refresh immediately on window focus or visibility return, and fetch both the conversation list and the currently selected thread.
**Alternatives Considered**: Rely on manual refresh, add a separate realtime service, or force Vercel to host Socket.IO. Manual refresh misses customer messages. A separate realtime service adds infrastructure not needed for this single-client deployment. Treating Vercel functions as a socket host caused the observed stale UI.
**Consequences**: Operators see new messages without refreshing, at the cost of a small amount of periodic API traffic while the inbox is open. If the product later needs higher scale or true push, move realtime to a managed websocket/realtime service.
**Superseded By**:

## Decision: Unknown Smart Automation Misses Require Customer Confirmation Before Handoff
**Date**: 2026-07-02
**Status**: Accepted
**Context**: Smart Automation can receive random strings or unsupported questions that do not match FAQs, products, Smart Flows, or retrieval. Immediately setting `needs_human` for those misses creates unnecessary support handoffs and makes the bot look more aggressive than helpful.
**Decision**: Store unmatched-message fallback as a pending confirmation in `conversation.bot_state.awaiting_human_confirmation` and send WhatsApp Yes/No buttons. Only a Yes response sets `needs_human`, pauses the bot, records `handoff_reason = 'customer_confirmed_handoff'`, and emits `handoff_requested`. A No response clears the pending state and asks the customer to rephrase.
**Alternatives Considered**: Keep silent logging only, or immediately hand off every miss. Silent logging gives customers no recovery path. Immediate handoff floods the Needs Human queue and contradicts the user-facing ask-before-handoff requirement.
**Consequences**: The Needs Human queue now represents customer-confirmed unknown-message escalations for this path. Bot learning still records unanswered messages, and operators are only pulled in after customer consent.
**Superseded By**:

## Decision: Handoff Resolve Owns Handoff Feedback
**Date**: 2026-07-02
**Status**: Accepted
**Context**: A Chat Inbox conversation can be both `needs_human` and `bot_paused`. Showing both Resolve Handoff and generic Resolve Chat created two feedback-sending paths for the same support interaction.
**Decision**: Treat `PATCH /conversations/:id/handoff/resolve` as the only feedback-sending resolve path for handoff conversations. Keep generic Resolve Chat only for bot-paused conversations that are not handoffs, and make the bot-pause feedback path idempotent by sending feedback only when the conversation was paused before the request.
**Alternatives Considered**: Leave both buttons visible and rely on operators, or make both routes clear all state. Operator discipline was rejected because it already caused duplicate messages. Making both routes equivalent was rejected because handoff resolution owns `needs_human` and `handoff_reason` state.
**Consequences**: Operators see one clear close action in handoff state, stale clients cannot send a second support-feedback request, and handoff state remains owned by the handoff route.
**Superseded By**:

## Decision: Chat Inbox Commerce Filters Use Mongo Order State
**Date**: 2026-07-02
**Status**: Accepted
**Context**: The main broadcast platform commit `3f088251462d3ae1210bfcfe3d13f0bb612cab7d` added Chat Inbox commerce filters using SQL `EXISTS` predicates. Narmada is a single-client Vercel fork backed by MongoDB/Mongoose, so copying the SQL route would not run.
**Decision**: Implement the same filter contract through Mongo `Order` queries in `backend/src/routes/whatsapp-chat.js`. The route derives phone sets for paid orders, unpaid hosted-checkout orders, and abandoned carts, returns `filter_counts`, and marks each conversation with commerce flags. `Order.tenant_id` is explicit with a `single-tenant` default, while the query remains compatible with older order documents that may not have the field.
**Alternatives Considered**: Copy the SQL strings from the main platform, keep the old client-side tab filtering, or only port the frontend dropdown. SQL would break on Mongo, client-side filtering would be wrong with pagination/counts, and frontend-only changes would show filters that the API could not honor.
**Consequences**: The Narmada fork matches the main platform UX while preserving its Mongo/Vercel deployment model. Counts are computed from the current archived/search base filter; for very large inboxes this may later need a Mongo aggregation optimization.
**Superseded By**:

## Decision: No-Order Handoff Is Deferred Behind FAQ Retrieval
**Date**: 2026-07-02
**Status**: Accepted
**Context**: Smart Flows can detect order-status intent before normal FAQ/product matching. When the phone has no order, returning the handoff immediately blocks valid delivery/payment/order-policy FAQs.
**Decision**: Treat `reason: 'order_not_found'` handoffs as fallback replies. Store that Smart Flow reply, try retrieval v2 and legacy FAQ/product matching, and return the handoff only when retrieval cannot answer.
**Alternatives Considered**: Disable order-status Smart Flow, always return no-order handoff, or move all retrieval ahead of flows. Those either remove useful order self-service, preserve the false-positive handoff, or weaken intentional flow replies.
**Consequences**: Client FAQs can answer general order/delivery/payment questions even when the customer has no order. A true no-order status request still escalates if there is no FAQ/product match.
**Superseded By**:

## Decision: Single-Client Vercel Product Uses Env-Only MongoDB
**Date**: 2026-07-01
**Status**: Accepted
**Context**: The Narmada fork is sold and deployed as a dedicated product for one client, not as a tenant seat on the original SaaS. The Vercel deployment must not depend on the original app database or any hardcoded fallback credentials.
**Decision**: Keep the fork single-client, deploy it on Vercel from `MBKANERIYA/narmada_broadcast`, require `MONGO_URI` from Vercel environment variables in production, and fail fast if it is missing.
**Alternatives Considered**: Reuse the original SaaS database or leave a fallback Atlas URI in code. Both were rejected because they break client isolation and expose secrets.
**Consequences**: Each client deployment must provision its own MongoDB Atlas database and set `MONGO_URI`; local development can still use `mongodb://127.0.0.1:27017/narmada_broadcast_dev`.
**Superseded By**:

## Decision: Smart Bot Uses Gemini Embeddings With Lexical Fallback
**Date**: 2026-07-01
**Status**: Superseded
**Context**: The deployed fork's chatbot and Knowledge Base were failing when `AI_API_KEY` was missing or when frontend AI Assistant routes did not exist. The product should remain usable before embeddings are configured.
**Decision**: Store FAQs/products even when embeddings cannot be generated, use Gemini embeddings when `AI_API_KEY` exists, and use deterministic lexical matching as the fallback responder path.
**Alternatives Considered**: Require `AI_API_KEY` before any FAQ/product can be saved, or return no bot matches until re-embed completes. Both were rejected because they make the client deployment feel broken during setup.
**Consequences**: Basic bot matching works immediately; semantic quality improves after adding `AI_API_KEY` and running re-embed.
**Superseded By**: [Single-Client Vercel Product Uses Local Smart Automation](#decision-single-client-vercel-product-uses-local-smart-automation)

## Decision: Single-Client Vercel Product Uses Local Smart Automation
**Date**: 2026-07-02
**Status**: Accepted
**Context**: The Narmada fork should be an independent single-client version of the main WhatsApp Broadcast platform, not a separate cloud-AI chatbot product. Requiring a provider key for Smart Automation created confusion and diverged from the main product.
**Decision**: Use local embedding models through `@huggingface/transformers` plus deterministic lexical fallback. Keep Vercel/MongoDB isolation for this client's deployment, but do not require Gemini, OpenAI, or any external provider key for FAQ/product matching or re-embedding.
**Alternatives Considered**: Keep the Gemini embedding endpoint as optional, or remove embeddings entirely and use only lexical matching. Optional Gemini was rejected because it changes the product/deployment contract; lexical-only was rejected because the main platform already uses local semantic matching.
**Consequences**: Vercel env setup only needs product infrastructure secrets like `MONGO_URI` and `JWT_SECRET`; local model cold starts may be slower on Vercel, so lexical fallback remains required.
**Superseded By**:

## Decision: Preact + Vite Frontend Framework
**Date**: 2026-04-10
**Status**: Accepted
**Context**: We need a fast, lightweight, and modern Single Page Application (SPA) frontend.
**Decision**: Use Preact (Vite template) with Zustand for state management.
**Alternatives Considered**: React (heavier bundle size), Vue (different programming model, JSX is preferred for matching React-like components).
**Consequences**: Smaller bundle sizes, fast builds. Requires `import from 'preact/hooks'` instead of `'react'`.

## Decision: MySQL 8.0 Prepared Statements and LIMIT/OFFSET Handling
**Date**: 2026-04-11
**Status**: Superseded
**Context**: MySQL `pool.execute()` prepared statements do not allow placeholders for LIMIT and OFFSET variables.
**Decision**: Parse and sanitize LIMIT and OFFSET as integers (`parseInt`) and inline them into SQL query strings rather than using `?` placeholders.
**Alternatives Considered**: Use `pool.query()` which does client-side interpolation, but `pool.execute()` is preferred for query caching and performance.
**Consequences**: Extra care is needed to ensure inlined values are strictly parsed as integers to prevent SQL injection.
**Superseded By**: [Single-Client Vercel Product Uses Env-Only MongoDB](#decision-single-client-vercel-product-uses-env-only-mongodb)

## Decision: Single-Domain Multi-Tenancy with Soft Resolution
**Date**: 2026-04-11
**Status**: Superseded
**Context**: The application runs on a single domain (`broadcast.innodify.in`) rather than separate subdomains for each tenant.
**Decision**: Resolve tenants softly using a custom header `x-tenant-slug` sent by the frontend, fallback to the `tenantId` stored inside the JWT auth token.
**Alternatives Considered**: Wildcard subdomains (too complex for initial DNS/SSL config).
**Consequences**: The frontend must send `x-tenant-slug` with every API request. Login must query by email globally across all tenants.
**Superseded By**: [Single-Client Vercel Product Uses Env-Only MongoDB](#decision-single-client-vercel-product-uses-env-only-mongodb)

## Decision: Free AI Chatbot Integration using Google Gemini API via OpenAI SDK
**Date**: 2026-06-12
**Status**: Superseded
**Context**: We need a smart auto-responder bot without requiring a paid OpenAI account.
**Decision**: Integrate Google's `gemini-1.5-flash` model utilizing the OpenAI compatibility layer by setting the base URL to `generativelanguage.googleapis.com/v1beta/openai/`.
**Alternatives Considered**: Paid OpenAI API, locally-hosted LLM (too resource-heavy for the VPS).
**Consequences**: High-quality, low-latency, and free chatbot responses. Outgoing message formats must align with Gemini constraints.
**Superseded By**: [Pure Local NLP Model Chatbot](#decision-pure-local-nlp-model-chatbot-superseding-gemini-api-integration)

## Decision: Pure Local NLP Model Chatbot (Superseding Gemini API Integration)
**Date**: 2026-06-12
**Status**: Superseded
**Context**: The project pivoted away from third-party remote AI APIs (Google Gemini API via OpenAI SDK) to guarantee offline reliability, eliminate external API key configuration requirements, and ensure responses are strictly aligned with the merchant's FAQ/product dataset.
**Decision**: Use a local feature-extraction pipeline with the `all-MiniLM-L6-v2` model running directly on the CPU. Match incoming messages to existing FAQs and products using cosine similarity.
**Alternatives Considered**: Google Gemini API (requires external API keys, internet connectivity, and can generate off-topic conversational text).
**Consequences**: The system was completely self-contained with zero external API key requirements. Responses were strictly bounded by active FAQs and products.
**Superseded By**: [Smart Bot Uses Gemini Embeddings With Lexical Fallback](#decision-smart-bot-uses-gemini-embeddings-with-lexical-fallback)

## Decision: Use Node Built-In Regression Tests
**Date**: 2026-06-16
**Status**: Accepted
**Context**: The code review fixes needed regression coverage without adding a heavyweight test framework or requiring live MySQL, Meta, Razorpay, SMTP, or Socket.io services.
**Decision**: Use Node.js built-in `node:test` with `node:assert/strict` for backend regression tests under `backend/test/*.test.js`, exposed through `npm test` in `backend/package.json`.
**Alternatives Considered**: Vitest or Jest for all JavaScript tests. Those would add more dependencies and configuration before the project has frontend component-test infrastructure.
**Consequences**: Regression tests are fast and dependency-light, but current coverage is mostly helper/static contract coverage rather than full HTTP/database integration coverage.
**Superseded By**:

## Decision: Maintained Local Transformer Runtime
**Date**: 2026-06-16
**Status**: Accepted
**Context**: `@xenova/transformers` is no longer the safest runtime dependency because it pins old ONNX/protobuf packages that trigger critical audit findings.
**Decision**: Keep the local CPU-bound semantic matching architecture, but import `pipeline` from `@huggingface/transformers` instead of `@xenova/transformers`.
**Alternatives Considered**: Force npm to override `@xenova/transformers` transitive ONNX packages, run `npm audit fix --force` and accept a downgrade, or remove local embeddings. Overrides risked untested ABI/API combinations, forced downgrade was marked breaking, and removing embeddings would regress the product.
**Consequences**: Dependency audit is clean while preserving the local FAQ/product embedding flow. First model load behavior should still be verified after deployment because the runtime package changed.
**Superseded By**:
