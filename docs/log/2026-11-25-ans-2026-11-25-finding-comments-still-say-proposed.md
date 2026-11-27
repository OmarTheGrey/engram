---
date: 2026-11-25
author: claude-agent
type: finding
card: ANS-2026-11-25
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/grants.ts
  - packages/core/src/distill/validate.ts
  - packages/core/src/export/otel.ts
supersedes: none
---

**What.** Source comments and test comments still call ADRs 0034, 0042 to 0048 proposed.

**Why.** This pull request is documents only; the lead's acceptance changes no behaviour.

**Result.** `grep -rlE "00(34|4[2-8])[^\n]{0,40}proposed"` finds such comments in `packages/core/src` (grants, promote, read, oracle, induce, validate, otel), `packages/server/src/export.ts`, `packages/runner/src/replay-validate.ts` and several tests. They were left unchanged. The one test file edited is `scripts/test/tasks-and-decisions.test.ts`, whose `OWNER_DECIDES` set listed the eight ADRs as awaiting the owner; it is now empty, so the test checks that each is decided and cited by a decision entry.

**Consequence.** The next card to touch each file can update its comment. Log entries dated before 2026-11-25 stay as written.
