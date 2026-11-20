---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** For I-3, "denied only for its source" means: the gate's check is the source rule or source isolation, and the same record at the kind the plane holds its id at would pass. Then the deny stands and the plane's item is not retracted.

**Why.** Re-evaluating at the plane's kind is exact: a record also below the floor, or of a forbidden class, still retracts. It runs in core with `evaluateWrite` called, not changed, so `evaluate.ts`, which other agents edit, is untouched.

**Result.** P21 and P23 keep the approved item; a confidence edit below the floor still retracts.

**Consequence.** The plane serves the approved version while the store holds the edit, until an allowed write of the item.
