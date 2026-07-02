# Smart Automation Miss Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep customer fallback helpful while preventing gibberish/noise from becoming FAQ-gap suggestions.

**Architecture:** Add a deterministic message triage service between Smart Automation no-match and learning/handoff. Store every no-match with a learning status, but let the Suggestions Queue and Top Unanswered use only meaningful FAQ-gap candidates.

**Tech Stack:** Node.js, Express webhook route, Mongoose models, Node built-in `node:test`.

---

### Task 1: Regression Tests

**Files:**
- Modify: `backend/test/regression.test.js`

- [ ] Add tests that assert gibberish is classified as ignored noise, meaningful business questions are classified as FAQ-gap candidates, greetings/thanks are low-friction chatter, and the Build button clusters only candidate unanswered rows.
- [ ] Run `cd backend && npm test` and verify the new tests fail before implementation.

### Task 2: Message Triage Service

**Files:**
- Create: `backend/src/services/messageTriage.js`

- [ ] Implement `triageUnansweredMessage(messageBody)` returning `learningStatus`, `replyAction`, `messageKind`, `qualityScore`, `businessScore`, and `reasonCodes`.
- [ ] Use conservative rules: allow short known words such as `hi`, `ok`, `cod`, and `price`; reject keyboard-smash/no-vowel junk; identify business terms for order, delivery, product, payment, return, fragrance, and support.
- [ ] Export customer copy constants for noise retry and meaningful handoff confirmation.

### Task 3: Learning Data Contract

**Files:**
- Modify: `backend/src/models/BotUnanswered.js`
- Modify: `backend/src/services/botLearning.js`

- [ ] Add indexed `learning_status` with default `candidate`.
- [ ] Let `logUnanswered()` accept `learningStatus` and `triage`.
- [ ] Make `clusterUnansweredSuggestions()` match only `status: 'new'` and `learning_status: 'candidate'` for the current tenant.
- [ ] Make analytics `top_unanswered` exclude ignored noise.

### Task 4: Webhook No-Match Flow

**Files:**
- Modify: `backend/src/routes/webhook.js`
- Modify: `backend/src/services/humanHandoffConfirmation.js`

- [ ] On no-match, triage the customer text before logging.
- [ ] For `replyAction: 'retry'`, send a plain retry message, do not set `awaiting_human_confirmation`, and log with `learning_status: 'noise'`.
- [ ] For `replyAction: 'confirm_handoff'`, keep the Yes/No confirmation and log with `learning_status: 'candidate'`.

### Task 5: Docs And Verification

**Files:**
- Modify: `knowledge-base/chatbot.md`
- Modify: `knowledge-base/whatsapp-webhook.md`
- Modify: `knowledge-base/known-issues.md`
- Modify: `knowledge-base/changelog.md`
- Modify: `knowledge-base/active-context.md`

- [ ] Document the new triage behavior and Build filtering.
- [ ] Run backend tests, backend syntax sweep, frontend lint/build, audits, and `git diff --check`.
