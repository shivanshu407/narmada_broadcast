# Chat Inbox

## What This Subsystem Does

Chat Inbox lets the client view WhatsApp conversations, send replies, send
templates/media, pause or resume Smart Automation for a customer, resolve human
handoffs, teach missed answers into Smart FAQs, and inspect WhatsApp media.

## How It Is Structured

| Path | Responsibility |
|------|----------------|
| `frontend/src/components/WhatsAppChat.jsx` | Chat list/detail UI, modals for resolving handoffs, resolving paused support chats, and teaching Smart FAQs. |
| `frontend/src/stores/store.js` | Zustand actions for `/api/v1/whatsapp/chat/*` API calls and realtime refresh handling. |
| `backend/src/routes/whatsapp-chat.js` | Express routes for conversations, messages, send/reply actions, bot pause, handoff resolution, teach-from-chat, labels, and media proxying. |
| `backend/src/models/WhatsAppConversation.js` | Conversation state including `bot_paused`, `needs_human`, `handoff_reason`, `bot_state`, labels, unread counts, and service-window timestamps. |
| `backend/src/models/WhatsAppChatMessage.js` | Stored inbound/outbound chat messages. |
| `backend/src/routes/webhook.js` | Creates/updates conversations from incoming WhatsApp webhooks and marks Smart Automation handoffs. |

## Conventions And Rules

- Frontend Chat Inbox routes use `/api/v1/whatsapp/chat/*`; backend route
  handlers live in `backend/src/routes/whatsapp-chat.js`.
- `PATCH /conversations/:id/bot-pause` toggles only the per-conversation
  `bot_paused` flag. Passing `send_feedback: true` while resuming sends the
  customer feedback buttons.
- `PATCH /conversations/:id/handoff/resolve` is the Resolve Handoff contract.
  It must clear `needs_human`, clear `bot_paused`, clear `handoff_reason`, and
  optionally send the same feedback request.
- `GET /conversations?needs_human=1` must filter the handoff queue
  server-side; the Needs Human tab depends on this.
- `POST /conversations/:id/teach` turns a question/answer from Chat Inbox into
  a Smart FAQ through `teachFromConversation()`.
- Handoff state belongs in MongoDB, not localStorage, because webhook
  auto-reply behavior depends on it.

## Known Gotchas

- The current Express mount order means `/api/v1/whatsapp` authenticates the
  broader path before `/api/v1/whatsapp/chat` handles chat routes. Do not move
  those mounts without making Chat Inbox explicitly authenticated.
- Vercel returns an HTML `Cannot PATCH ...` page when a route is missing; the
  frontend toast will display that HTML if the backend route contract drifts.
- Sending feedback has an external Meta API side effect. Browser QA should not
  click resolve/send actions on live customer conversations unless the user
  authorizes it.
- Uploaded local media is serverless-temp backed; persistent media storage is
  not yet implemented for Vercel.

## How It Is Tested

`backend/test/regression.test.js` covers:

- Chat Inbox frontend route paths matching backend route handlers.
- Server-side `needs_human=1` filtering.
- Handoff resolution clearing `needs_human`, `bot_paused`, and `handoff_reason`.
- Teach-from-chat route coverage.
- Persisted `bot_paused` behavior and webhook pause checks.

Run:

```bash
cd backend
npm test
```

## Related KB Files

- `chatbot.md` for Smart Automation matching, handoff generation, and teaching.
- `frontend.md` for app shell and UI conventions.
- `security.md` for auth, secret handling, and server-side handoff state.
- `testing.md` for full verification gates.
