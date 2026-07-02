## Current Status
**Last Updated**: 2026-07-02
**Last Agent Session**: Updated deployment context after the Vercel project moved to `https://broadcast-gilt.vercel.app/`; GitHub remains `MBKANERIYA/narmada_broadcast`, and PR https://github.com/MBKANERIYA/narmada_broadcast/pull/8 still carries the chat feedback and Vercel refresh fixes.
**Test Suite Status**: Docs-only URL update after the last full code verification. Last full suite: PASS - `cd backend && npm test` (28 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (10 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`. URL update verification: PASS - active URL references checked with `rg`; PASS - `git diff --check`.

## In Progress
- [ ] Have the upstream owner merge PR https://github.com/MBKANERIYA/narmada_broadcast/pull/8, then let Vercel redeploy from `main`.
- [ ] Smoke-test live Vercel unknown-message behavior on `https://broadcast-gilt.vercel.app/`: send a nonsense customer text, confirm the bot asks "Sorry, I didn't understand..." with Yes/No buttons, tap No and verify no Needs Human state, then repeat and tap Yes to verify Needs Human appears.
- [ ] Smoke-test live Vercel support feedback on `https://broadcast-gilt.vercel.app/`: resolve a test chat, tap Good/Bad in WhatsApp, and verify the only bot response is "Thank you for your feedback."
- [ ] Smoke-test live Vercel Chat Inbox freshness on `https://broadcast-gilt.vercel.app/`: receive a new WhatsApp message and verify the conversation list/open thread update within about 5 seconds without refreshing.
- [ ] Smoke-test Chat Inbox filters on the live Vercel URL: All, Unread, Paid orders, Unpaid orders, Abandoned carts, Needs human, filter counts, and conversation chips.
- [ ] Smoke-test Chat Inbox handoff state on the live Vercel URL: a `needs_human + bot_paused` conversation should show Needs Human/Resolve Handoff but not the green Resolve Chat button, and resolving should send one feedback request.
- [ ] Confirm Vercel production env vars still include `MONGO_URI` and `JWT_SECRET`.

## Blocked On
- GitHub push permission - `shivanshu407` has read-only access to `MBKANERIYA/narmada_broadcast`, so updates are pushed to the fork and opened through a PR.
- Vercel/MongoDB setup is manual: the code cannot create the client's Atlas database or set Vercel env vars from this local checkout.

## Decisions Needed
- None for this change.

## Next Steps (for the next agent session)
1. Check whether PR https://github.com/MBKANERIYA/narmada_broadcast/pull/8 is merged into `MBKANERIYA/narmada_broadcast:main`.
2. After merge, check the Vercel deployment status for the new `main`.
3. Log in on `https://broadcast-gilt.vercel.app/` and verify Settings -> Automation & Hours, Knowledge Base, Test Your Bot, Chat Inbox timestamps, Resolve Handoff, teach-from-chat, commerce filters, the single resolve action, support-feedback thank-you, inbox polling refresh, and unknown-message Yes/No handoff confirmation.
4. Rotate/delete the previously exposed Atlas user from the old hardcoded URI if that manual cleanup has not already been completed.

## Do Not Touch
- Do not reintroduce hardcoded MongoDB credentials or point this fork at the original SaaS database.
- Do not restore external AI provider requirements; Smart Automation is local with lexical fallback.
- Do not convert this into a tenant-seat SaaS deployment unless the client requirement changes.
