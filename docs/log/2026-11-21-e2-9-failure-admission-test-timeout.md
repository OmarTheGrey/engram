---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/secrets.test.ts
  - packages/core/scripts/admission.ts
supersedes: none
---

**What.** The test that admission refuses a quadratic and a slow linear rule timed out at 30 s.

**Why.** A slow rule was timed on every input at full size before the cost verdict.

**Result.** The controls run at n = 1,024, and admission refuses a rule at once when it is already three times over the cost limit; the full verdict still uses the sums. The test takes seconds.

**Consequence.** None.
