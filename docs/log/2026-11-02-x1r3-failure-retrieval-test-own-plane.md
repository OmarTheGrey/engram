---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/retrieval.test.ts
supersedes: none
---

**What.** The retrieval property test built its own plane, so the runner's `coreReadPlane` wiring was untested: dropping its limit passed all 45 tests.

**Why.** The test reproduced the wiring instead of calling it.

**Result.** Every read now goes through the `memory_read` tool of a session built by `conditionSession`. Dropping the limit in `coreReadPlane` fails 9 tests, removing the wrap 30, and C4 without the walk 20.

**Consequence.** Found by the third review of PR #25 and fixed in its round-3 fix pass.
