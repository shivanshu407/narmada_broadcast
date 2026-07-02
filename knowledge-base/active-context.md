## Current Status
**Last Updated**: 2026-07-02
**Last Agent Session**: Restored the Mongo/Vercel Chat Inbox backend contract for Resolve Handoff, teach-from-chat, and server-side Needs Human filtering on the existing PR branch.
**Test Suite Status**: PASS - `cd backend && npm test` (22 tests); PASS - backend `node --check` sweep; PASS - `cd frontend && npm run lint` (9 warnings, 0 errors); PASS - `cd frontend && npm run build`; PASS - `npm audit --audit-level=high` in both `backend/` and `frontend/`; PASS - `git diff --check`.

## In Progress
- [ ] Have `MBKANERIYA/narmada_broadcast` accept PR #2 from `shivanshu407:codex/vercel-transformer-cache`, or grant direct write access and push the branch to `main`.
- [ ] Set/verify Vercel production env vars after merge, especially `MONGO_URI` and `JWT_SECRET`.
- [ ] Redeploy or let Vercel auto-deploy from `main`, then smoke-test Settings -> Automation & Hours multilingual re-embed, no-order FAQ fallback, Chat Inbox Needs Human filtering, Resolve Handoff, and teach-from-chat on the live URL.

## Blocked On
- GitHub push permission - `shivanshu407` has read-only access to `MBKANERIYA/narmada_broadcast`, so updates are pushed to fork branch `codex/vercel-transformer-cache` and opened through a PR.
- Vercel/MongoDB setup is manual: the code cannot create the client's Atlas database or set Vercel env vars from this local checkout.

## Decisions Needed
- None for Smart Automation provider setup; this fork should not require an external provider key.

## Next Steps (for the next agent session)
1. Have the upstream owner review and merge PR #2 from `shivanshu407:codex/vercel-transformer-cache`.
2. Check the Vercel deployment status after `main` is updated.
3. Confirm `MONGO_URI=<mongodb-connection-string>` and `JWT_SECRET=<strong-random-jwt-secret>` are set in Vercel.
4. Rotate/delete the previously exposed Atlas user from the old hardcoded URI.
5. Log in on `https://narmada-broadcast-8vox.vercel.app/` and verify Settings -> Automation & Hours multilingual re-embed, Knowledge Base, Test Your Bot, Needs Human filtering, Resolve Handoff, and teach-from-chat.

## Do Not Touch
- Do not reintroduce hardcoded MongoDB credentials or point this fork at the original SaaS database.
- Do not restore the unused `backend/src/routes/leads.js` mailer route without adding a mounted route, a real requirement, and a safe current mailer dependency.
