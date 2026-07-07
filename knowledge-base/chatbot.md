# Smart Automation And Smart Knowledge Base

## What This Subsystem Does

Smart Automation answers customer WhatsApp messages from the client's own FAQ,
product, order, and store-hours data. It powers the Knowledge Base test console,
the Settings automation control center, and webhook auto-replies. Matching is
self-contained: the backend uses local embedding models (such as `multilingual-e5-small` to natively support queries in English, Hindi, and Gujarati) when vectors are
available and deterministic lexical matching as the fallback.

## Structure

| File | Responsibility |
|------|----------------|
| `backend/src/services/smartResponder.js` | Main FAQ/product reply matcher, local vector cache, lexical fallback |
| `backend/src/config/embeddingConfig.js` | Local MiniLM and multilingual E5 model registry |
| `backend/src/services/botLearning.js` | Analytics, unanswered logging, suggestions, teach-from-chat helpers |
| `backend/src/services/messageTriage.js` | Deterministic no-match triage for noise, chatter, human requests, and FAQ-gap candidates |
| `backend/src/services/retrievalEngine.js` | Optional retrieval v2 path when enabled by bot flags |
| `backend/src/services/smartFlows.js` | Order/product flow helpers and handoff replies |
| `backend/src/routes/knowledge-base.js` | FAQ CRUD, import, test console, alternate phrasings |
| `backend/src/routes/tenant-settings.js` | Automation settings, analytics, test, suggestions, and re-embed endpoints |
| `backend/src/routes/webhook.js` | Incoming WhatsApp message processing and auto-reply dispatch |

## Suggestions Queue And Build Button

Settings -> Automation & Hours shows a Suggestions Queue built from bot
learning data. The queue is not a customer-facing reply by itself; it is an
operator-facing list of FAQ gaps the bot has seen.

- `Top Unanswered` comes from `BotUnanswered` analytics and shows meaningful
  FAQ-gap candidates, not ignored noise/chatter.
- The `Build` button calls
  `POST /api/v1/tenant-settings/smart-automation/learning/cluster` with
  `{ limit: 100 }`.
- The backend groups `BotUnanswered` rows with `status: 'new'` and
  `learning_status: 'candidate'` by `normalized_message`, upserts open
  `BotSuggestion` records with `suggestion_type: 'faq_gap'`, then the frontend
  reloads analytics and suggestions.
- Build also re-triages legacy unanswered rows that do not yet have
  `learning_status`, and closes stale open FAQ-gap suggestions when no
  candidate unanswered row remains. This lets Build clear old junk suggestions
  such as `fdrdfvdf` after deploy.
- Build does not automatically add a Smart FAQ answer. It only refreshes the
  open suggestions queue so an operator can decide what FAQ/content to add or
  teach.
- As of 2026-07-03 before the triage fix, live verification on
  `https://broadcast-gilt.vercel.app/` returned HTTP 200 for Build and rebuilt
  the existing `fdrdfvdf` suggestion from one unanswered log. After the triage
  fix deploys, pressing Build should close that stale noise suggestion.

## No-Match Triage

When Smart Automation cannot find a FAQ, product, retrieval answer, or Smart
Flow reply, the webhook calls `triageUnansweredMessage()` before deciding what
to send and how to log learning data.

| Triage Result | Customer Reply | Learning Behavior |
|---------------|----------------|-------------------|
| `noise` | Plain retry text: "I couldn't understand that..." | Stored as `learning_status: 'noise'`; excluded from Top Unanswered and Build |
| `chatter` | Lightweight acknowledgement: "You're welcome..." | Stored as `learning_status: 'chatter'`; excluded from Top Unanswered and Build |
| `candidate` | Yes/No prompt asking whether to connect a human | Stored as `learning_status: 'candidate'`; eligible for Suggestions Queue Build |
| `handoff` | Direct store-team handoff text | Stored as `learning_status: 'handoff'`; not a FAQ-gap suggestion |

The triage is deterministic and provider-free. It uses conservative text
quality rules, repeated-pattern detection, and a small business vocabulary for
Narmada support terms such as order, delivery, diffuser, refill, fragrance,
payment, return, COD, price, shop, and warranty.

## Conventions And Rules

- Do not add any external provider key requirement for Smart Automation.
- Configure local model cache paths before loading `@huggingface/transformers` pipelines; Vercel must use a writable temp cache, not `node_modules`.
- FAQ and product saves must remain usable even if vector generation fails.
- Do not let a no-order status flow block FAQ/product answers. `order_not_found` handoff is a fallback after retrieval cannot answer.
- If no FAQ, product, retrieval answer, or Smart Flow reply matches a customer
  message, triage the miss before escalating. Noise/chatter should not create
  a human handoff prompt or Suggestions Queue item.
- Meaningful no-match messages still ask before escalating. The webhook sends
  the prompt "Sorry, I didn't understand. Do you want me to add a human to
  resolve your issue?" with Yes/No buttons and stores
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
- No-match triage for gibberish, repeated nonsense, short business questions,
  chatter, and meaningful FAQ-gap candidates.
- Suggestions Queue Build filtering so only `learning_status: 'candidate'`
  unanswered messages become FAQ-gap suggestions.
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
