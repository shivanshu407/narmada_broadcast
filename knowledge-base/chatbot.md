# Smart Automation And Smart Knowledge Base

## What This Subsystem Does

Smart Automation answers customer WhatsApp messages from the client's own FAQ,
product, order, and store-hours data. It powers the Knowledge Base test console,
the Settings automation control center, and webhook auto-replies. Matching is
self-contained: the backend uses local embedding models when vectors are
available and deterministic lexical matching as the fallback.

## Structure

| File | Responsibility |
|------|----------------|
| `backend/src/services/smartResponder.js` | Main FAQ/product reply matcher, local vector cache, lexical fallback |
| `backend/src/config/embeddingConfig.js` | Local MiniLM and multilingual E5 model registry |
| `backend/src/services/botLearning.js` | Analytics, unanswered logging, suggestions, teach-from-chat helpers |
| `backend/src/services/retrievalEngine.js` | Optional retrieval v2 path when enabled by bot flags |
| `backend/src/services/smartFlows.js` | Order/product flow helpers and handoff replies |
| `backend/src/routes/knowledge-base.js` | FAQ CRUD, import, test console, alternate phrasings |
| `backend/src/routes/tenant-settings.js` | Automation settings, analytics, test, suggestions, and re-embed endpoints |
| `backend/src/routes/webhook.js` | Incoming WhatsApp message processing and auto-reply dispatch |

## Conventions And Rules

- Do not add any external provider key requirement for Smart Automation.
- Configure local model cache paths before loading `@huggingface/transformers` pipelines; Vercel must use a writable temp cache, not `node_modules`.
- FAQ and product saves must remain usable even if vector generation fails.
- Do not let a no-order status flow block FAQ/product answers. `order_not_found` handoff is a fallback after retrieval cannot answer.
- If no FAQ, product, retrieval answer, or Smart Flow reply matches a customer
  message, ask before escalating. The webhook sends the prompt
  "Sorry, I didn't understand. Do you want me to add a human to resolve your
  issue?" with Yes/No buttons and stores
  `bot_state.awaiting_human_confirmation`.
- Only a Yes response to that unknown-message prompt should create a human
  handoff. No responses clear the pending state and ask the customer to
  rephrase.
- Keep `invalidateTenantVectorCache()` calls when FAQ, phrasing, product, or bot-setting changes affect retrieval.
- The Knowledge Base list API returns `{ faqs: [...] }` because the frontend consumes `data.faqs`.
- The Knowledge Base test console route is `POST /api/v1/knowledge-base/test`.
- Settings automation routes live under `/api/v1/tenant-settings/smart-automation/*`.
- Text fallback threshold is aligned with the UI expectation of `0.45`.

## Known Gotchas

- Vercel functions are stateless; local model warmup can happen again after cold starts.
- Vercel's `/var/task` bundle is read-only. `smartResponder.js` points Transformers.js at `os.tmpdir()/narmada-transformers-cache`; only override it with `TRANSFORMERS_CACHE_DIR` when the target path is writable.
- Order-status intent can match broad delivery/payment/order wording. When no order exists for that phone, the handoff must be deferred so FAQ/product retrieval can answer policy questions first.
- Unknown-message handoff confirmation is a webhook concern, not a Smart
  Responder match. If you change no-match behavior, read
  `whatsapp-webhook.md` and keep the pending state persisted in MongoDB.
- If vectors are empty because a previous deployment skipped embedding, use the Settings re-embed action.
- Do not rename the persisted `bot_settings` field without a migration; it is internal state even though the UI says Smart Automation.

## How It Is Tested

`backend/test/regression.test.js` covers:

- Smart Automation route contracts used by Settings.
- Knowledge Base list/test/phrasings contracts used by the frontend.
- `scoreTextMatch()` behavior for text-only FAQ/product matching.
- Serverless-safe Transformers.js cache configuration for local model downloads.
- No-order Smart Flow fallback behavior before human handoff.
- Unknown-message ask-before-handoff confirmation behavior.
- Absence of external provider key requirements in active source and product docs.

Run:

```bash
cd backend
npm test
```

## Related KB Files

- `ARCHITECTURE.md` for the full system shape.
- `DEPLOYMENT.md` for `MONGO_URI` setup.
- `whatsapp-webhook.md` for inbound message, pending confirmation, and handoff state flow.
- `testing.md` for verification commands.
- `security.md` for secret masking and webhook concerns.
