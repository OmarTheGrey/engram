---
date: 2026-11-22
author: claude-agent
type: failure
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** After the one-seed replay cases began to throw, invariant 2's guard for a refusal only the no-worse rule makes saw 0 cases, and the test failed.

**Why.** That refusal needs three seeds and a third-seed miss. Turning one-seed cases into refusals left too few such cases.

**Result.** The third-seed miss went from one case in three to one in two. `make test-invariants`: 17 passed, every replay guard above 0.

**Consequence.** A change to the generator is rerun against every guard, not only the one it targets.
