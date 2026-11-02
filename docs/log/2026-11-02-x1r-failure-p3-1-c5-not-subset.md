---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/retrieval.test.ts
supersedes: none
---

**What.** C5's read returned items C2 to C4 never saw: core matched granted items on any query term while the fake and Letta stores' search needs every term ("what is the schedule": C2 0 items, C5 103).

**Why.** PR 3 checked that each condition read the same items, not that C5's were a subset of C2's for natural queries.

**Result.** Fixed in core (every-term match) with a property test over every fixture checkpoint.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
