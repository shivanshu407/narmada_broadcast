# WhatsApp Webhook

## What This Subsystem Does

The WhatsApp webhook receives Meta Cloud API message and status callbacks,
stores inbound/outbound chat history, updates conversations, processes incoming
WhatsApp cart orders, and dispatches Smart Automation replies for the
single-client product.

## How It Is Structured

| Path | Responsibility |
|------|----------------|
| `backend/src/routes/webhook.js` | Main webhook route mounted at `/api/v1/whatsapp-webhook`; handles inbound messages, status updates, cart orders, Smart Automation replies, and handoff state. |
| `backend/src/services/whatsapp.js` | Meta Cloud API send helpers for text, media, templates, and interactive messages. |
| `backend/src/services/humanHandoffConfirmation.js` | Builds the unknown-message Yes/No prompt and parses customer confirmation replies. |
| `backend/src/services/supportFeedback.js` | Parses support-resolution feedback button replies and defines the thank-you acknowledgement. |
| `backend/src/services/smartResponder.js` | Finds FAQ/product/retrieval replies and delegates Smart Flow checks. |
| `backend/src/services/smartFlows.js` | Handles order status, product search, and explicit customer support intents. |
| `backend/src/models/WhatsAppConversation.js` | Stores chat state, including `bot_paused`, `needs_human`, `handoff_reason`, and `bot_state`. |
| `backend/src/models/WhatsAppChatMessage.js` | Stores inbound and outbound messages shown in Chat Inbox. |

## Conventions And Rules

- Do not require an external provider key for webhook automation replies.
- Always store inbound messages before automation logic so Chat Inbox reflects
  what the customer sent even if automation fails.
- Respect `conversation.bot_paused`; paused conversations must not receive
  automated replies.
- Keep `conversation.bot_state` as the place for short-lived automation state.
- Unknown no-match messages must ask the customer before creating a human
  handoff. Store pending confirmation as
  `bot_state.awaiting_human_confirmation`.
- Support feedback button replies (`feedback_good`, `feedback_bad`) are terminal
  webhook events. Store the rating, send the thank-you acknowledgement, and do
  not pass those replies into Smart Automation.
- Only a Yes response to the unknown-message prompt should set `needs_human`,
  set `bot_paused`, set `handoff_reason`, and emit `handoff_requested`.
- No responses clear pending confirmation and ask the customer to rephrase.
- Smart Flow handoffs for explicit support intent still use the existing
  handoff path; no-order handoffs remain deferred behind FAQ/product retrieval.
- Cart order messages are handled before Smart Automation replies and then
  skipped so the customer does not receive two responses.

## Known Gotchas

- Vercel functions are stateless, so pending conversation state must be in
  MongoDB, not memory.
- Meta interactive button replies arrive as `msg.type === 'interactive'` with
  `button_reply.id`; old button replies can also appear under `msg.button`.
- `bodyText` stores the button title for display, but state transitions should
  prefer stable reply IDs where available.
- Do not parse free-text "Good" or "Bad" as support feedback. Only button
  payload IDs should close the feedback path.
- If a customer ignores a pending Yes/No prompt and sends a new question, the
  webhook clears the pending flag and lets Smart Automation evaluate the new
  message normally.
- Status callbacks and inbound messages share the route; avoid changes that
  make message-processing failures block status updates for unrelated entries.

## How It Is Tested

`backend/test/regression.test.js` covers:

- Persisted bot pause checks before auto-reply.
- No-order Smart Flow handoffs being deferred behind FAQ/product retrieval.
- Unknown-message confirmation prompt payload, Yes/No parser, pending
  `bot_state`, and webhook handoff wiring.
- Support feedback button replies being acknowledged without Smart Automation.
- Chat Inbox route contracts that consume `needs_human` and handoff state.

Run:

```bash
cd backend
npm test
```

## Related KB Files

- `chatbot.md` for Smart Automation matching and learning behavior.
- `chat-inbox.md` for handoff queue and resolve behavior.
- `security.md` for webhook and secret-handling concerns.
- `testing.md` for full verification gates.
