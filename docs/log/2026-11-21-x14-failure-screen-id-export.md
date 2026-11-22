---
date: 2026-11-21
author: claude-agent
type: failure
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/test/redteam/run.test.ts
supersedes: none
---

**What.** A run test failed with an undefined policy id.

**Why.** `INJECTION_SCREEN_ID` is not exported from `@engram/core`'s index, so the import was undefined.

**Result.** The test names the rule id itself, with a comment pointing at its source.

**Consequence.** None.
