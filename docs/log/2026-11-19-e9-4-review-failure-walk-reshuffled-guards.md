---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** The first version of invariant 5's grant steps, added to its original step arbitrary, failed the invariant's coverage guards.

**Why.** The new step kind and the grantee reads changed every draw: `utilityByReads` and later `sweepEvicted` fell to 0, and grant changes rarely landed because most named an item the walk did not hold (23 allowed in 1000 runs, none admitting a read).

**Result.** Grant steps now pick an item the walk holds, a removal prefers one carrying a grant, and the grant steps run as a second walk with its own seed, so the original walk draws exactly as before.

**Consequence.** None beyond the decision of the same day.
