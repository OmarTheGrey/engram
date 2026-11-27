---
date: 2026-11-27
author: claude-agent
type: failure
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/counterexamples/read-disclosure.test.ts
  - packages/core/test/unit/plane/supersede.test.ts
  - packages/core/src/lint/supersession.ts
supersedes: none
---

**What.** Two new tests first failed on their own setup, not on the code under test.

**Why.** One: a rewrite meant to be refused by the grant rule changed the class to procedural, and the write was refused under `engram/write/schema` before any grant rule ran. Two: the owner's supersession plan in the `writeClosures` test proposed no close but a review, because the hidden ancestor's window overlapped the candidate's from the same start, which the supersession lint flags for a person.

**Result.** The rewrite now adds sam's grant a second time (refused under `engram/grant/unchanged`, its reason quoting sam), and the ancestor's window ends before the candidate's starts. The first then failed for the right reason before the fix; the second fails when the disclosure is removed (mutation, restored). Both pass.

**Consequence.** Nothing beyond the tests.
