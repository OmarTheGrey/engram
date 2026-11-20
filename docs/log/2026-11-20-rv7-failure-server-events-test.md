---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/contract.test.ts
  - "make test"
supersedes: none
---

**What.** The first full `make test` after the RV-CORE-4 change failed one test out of 3,334: the server contract test "events: an item in a scope the read matrix keeps from the viewer is withheld (R3-4)".

**Why.** That test posts `/events` as a team-level member of `person:dana` and expected the write event shown with its item withheld. The fix now withholds the whole event, which is the intended change. Core's own tests had been run, but the server package had not been run before the full suite.

**Result.** The test now expects no event for that viewer, and the owner still sees the item. The contract suite passes (27 tests).

**Consequence.** `packages/server/test/contract.test.ts` is a shared file that card RV5 may also touch. The edit is two lines.
