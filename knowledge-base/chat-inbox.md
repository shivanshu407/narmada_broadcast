# Chat Inbox

## What This Subsystem Does

Chat Inbox lets the client view WhatsApp conversations, send replies, send
templates/media, pause or resume Smart Automation for a customer, resolve human
handoffs, teach missed answers into Smart FAQs, and inspect WhatsApp media.

## How It Is Structured

| Path | Responsibility |
|------|----------------|
| `frontend/src/components/WhatsAppChat.jsx` | Chat list/detail UI, modals for resolving handoffs, resolving paused support chats, and teaching Smart FAQs. |
| `frontend/src/utils/chatDates.js` | Shared timestamp parsing/formatting for Mongo ISO strings, legacy SQL-style UTC strings, and invalid values. |
| `frontend/src/stores/store.js` | Zustand actions for `/api/v1/whatsapp/chat/*` API calls and realtime refresh handling. |
| `backend/src/routes/whatsapp-chat.js` | Express routes for conversations, messages, send/reply actions, bot pause, handoff resolution, teach-from-chat, labels, and media proxying. |
| `backend/src/services/supportFeedback.js` | Shared support feedback button IDs and thank-you acknowledgement consumed by webhook support ratings. |
| `backend/src/models/WhatsAppConversation.js` | Conversation state including `bot_paused`, `needs_human`, `handoff_reason`, `bot_state`, labels, unread counts, and service-window timestamps. |
| `backend/src/models/WhatsAppChatMessage.js` | Stored inbound/outbound chat messages. |
| `backend/src/models/Order.js` | Commerce state used to tag/filter conversations as paid, unpaid hosted-checkout orders, or abandoned carts. |
| `backend/src/routes/webhook.js` | Creates/updates conversations from incoming WhatsApp webhooks and marks Smart Automation handoffs. |

## Conventions And Rules

- Frontend Chat Inbox routes use `/api/v1/whatsapp/chat/*`; backend route
  handlers live in `backend/src/routes/whatsapp-chat.js`.
- `PATCH /conversations/:id/bot-pause` toggles only the per-conversation
  `bot_paused` flag. Passing `send_feedback: true` while resuming sends the
  customer feedback buttons only for non-handoff support chats that were paused
  before the request.
- `PATCH /conversations/:id/handoff/resolve` is the Resolve Handoff contract.
  It must clear `needs_human`, clear `bot_paused`, clear `handoff_reason`, and
  optionally send the same feedback request.
- After feedback buttons are sent, WhatsApp `feedback_good` and `feedback_bad`
  replies belong to the webhook terminal support-feedback path. They should not
  re-enter Smart Automation as a customer question.
- The frontend keeps a 5-second polling fallback in `WhatsAppChat.jsx` while
  Chat Inbox is mounted because Vercel serverless Socket.IO refresh is not
  reliable enough on its own. Polling refreshes the conversation list and the
  currently open thread, skips hidden tabs, and refreshes on focus/visibility.
- Unknown-message Smart Automation misses should not appear in Needs Human until
  the customer taps or types Yes on the webhook confirmation prompt. That Yes
  path sets `needs_human`, `bot_paused`, and `handoff_reason =
  'customer_confirmed_handoff'`.
- When `needs_human` is active, the UI must expose Resolve Handoff as the only
  feedback-sending close action. Do not show the generic Resolve Chat button in
  that state.
- `GET /conversations?needs_human=1` must filter the handoff queue
  server-side; the Needs Human tab depends on this.
- `GET /conversations?filter=<value>` is the current filter contract. Supported
  values are `all`, `unread`, `paid`, `unpaid_orders`, `abandoned_carts`, and
  `needs_human`. Legacy `paid=1` and `needs_human=1` callers still map to the
  corresponding filter.
- The conversations response must include `filter_counts` plus conversation
  booleans `has_paid_order`, `has_unpaid_order`, and `has_abandoned_cart`.
- Commerce filters are computed from Mongo `Order` rows matched by phone. Unpaid
  orders are hosted-checkout `ordered` + pending-payment orders with a payment
  link. Abandoned carts are hosted-checkout `open` + pending-payment sessions
  without a payment link, not expired, and older than
  `CHECKOUT_ABANDONED_AFTER_MINUTES` (default 30 minutes).
- `POST /conversations/:id/teach` turns a question/answer from Chat Inbox into
  a Smart FAQ through `teachFromConversation()`.
- Handoff state belongs in MongoDB, not localStorage, because webhook
  auto-reply behavior depends on it.
- Keep the compact header classes (`chat-inbox-compact-header`,
  `chat-inbox-heading`, `chat-inbox-compact-subtitle`) aligned with the main
  broadcast platform unless the client asks for a separate visual treatment.
- Format dates through `chatDates.js`; do not reintroduce the old append-`Z`
  inline parser because Mongo ISO strings already include timezone markers.

## Known Gotchas

- The current Express mount order means `/api/v1/whatsapp` authenticates the
  broader path before `/api/v1/whatsapp/chat` handles chat routes. Do not move
  those mounts without making Chat Inbox explicitly authenticated.
- Vercel returns an HTML `Cannot PATCH ...` page when a route is missing; the
  frontend toast will display that HTML if the backend route contract drifts.
- Mongo/Mongoose serializes dates as ISO strings. Legacy MySQL-style
  `YYYY-MM-DD HH:mm:ss` and Mongo ISO strings both appear in project history,
  so Chat Inbox date formatting must support both.
- Sending feedback has an external Meta API side effect. Browser QA should not
  click resolve/send actions on live customer conversations unless the user
  authorizes it.
- A customer tapping Good/Bad after support resolution should receive only the
  thank-you acknowledgement. If a welcome, FAQ, product, or handoff reply appears
  after feedback, the webhook feedback short-circuit has regressed.
- Vercel inbox freshness depends on the polling fallback. Removing it without
  adding a separate realtime service will bring back manual-refresh-only
  behavior.
- A conversation can be both `needs_human` and `bot_paused`. Resolve Handoff owns
  that state. The generic bot-pause support resolve must not send feedback for
  handoff conversations or already-resumed conversations.
- `bot_state.awaiting_human_confirmation` is separate from `needs_human`; do not
  show Needs Human UI for pending confirmation alone.
- Uploaded local media is serverless-temp backed; persistent media storage is
  not yet implemented for Vercel.
- Older checkout orders may not have `tenant_id`; the commerce filter keeps a
  single-client compatibility path for those documents.

## How It Is Tested

`backend/test/regression.test.js` covers:

- Chat Inbox frontend route paths matching backend route handlers.
- Server-side `needs_human=1` filtering.
- Handoff resolution clearing `needs_human`, `bot_paused`, and `handoff_reason`.
- Single feedback-sending resolve action for handoffs, including the backend
  guard against duplicate support-feedback sends.
- Support-feedback button replies being acknowledged without entering Smart
  Automation.
- Chat Inbox polling fallback for Vercel, including list refresh, selected
  thread refresh, focus refresh, and visibility refresh.
- Unknown-message confirmation only creating handoff state after a Yes response.
- Teach-from-chat route coverage.
- Persisted `bot_paused` behavior and webhook pause checks.
- Compact-header UI class contracts and Mongo-safe chat date formatting.
- Commerce-status filtering through Mongo orders, including `filter_counts`,
  dropdown UI state, and paid/unpaid/abandoned chips.

Run:

```bash
cd backend
npm test
```

## Related KB Files

- `chatbot.md` for Smart Automation matching, handoff generation, and teaching.
- `whatsapp-webhook.md` for inbound confirmation prompt handling.
- `frontend.md` for app shell and UI conventions.
- `hosted-checkout.md` for checkout order states used by commerce filters.
- `security.md` for auth, secret handling, and server-side handoff state.
- `testing.md` for full verification gates.
