---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.21
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** The promotion exemption is carried by `evaluateWrite`'s existing `promotion` option, which the promotion gate now passes for both its transitions, not for the in-place one only.

**Why.** Decision 6 exempts a promotion's new version, which `evaluatePromotion` judges as a first write (no projected item, no `at`). A new option would widen a signature card E2.15 also edits; the old one already means "the promotion gate's call". For a new version the owner rule's exemption cannot apply (it needs a projected item and checks `onlyStatusAndVersion`), so passing it changes nothing else.

**Result.** With the option on, the owner's class-changing promotion keeps its episodic grant (RV7-R1 and item 35 pass under the twin profile), and a grant past the cap written before the option survives the owner's promotion. Reverting to `transition === "in-place"` fails three tests.

**Consequence.** If wrong, a promotion would need its own flag; `write.ts` is untouched.
