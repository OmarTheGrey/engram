---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
supersedes: docs/log/2026-11-21-e2-12-decision-what-agreement-means.md
---

**What.** On top of the decision, the deciding rule id among Cedar's reasons, `write_without_review` and zero evaluation errors, the test now requires four more things.

**Why.** Review findings E2.12-1 and E2.12-2: a duplicate rule id let the last duplicate overwrite the first, so first-rule-wins was untested; and `toContain` let a grant win over a readable scope.

**Result.**
- Unique rule ids, checked by a test and refused by the test's engine.
- Scope before grant: when Cedar's reasons hold both the matrix row and `read/grants`, the evaluator names the row.
- A property over the presets with a duplicated write rule, matrix row and retention rule, 150 policies of 20 reads and 20 writes. Its guards require more than 20 cases each where a duplicate taken would decide otherwise. An example case is included.
- 1,000 generated policies instead of 400.

**Consequence.** The test takes about 18 seconds.
