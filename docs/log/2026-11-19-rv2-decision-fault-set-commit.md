---
date: 2026-11-19
author: claude-agent
type: decision
card: RV2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - "git diff --stat f1f07f4^ f1f07f4 -- packages/core: plane/write.ts, policy/evaluate.ts changed"
supersedes: none
---

**What.** The h3-fault-set row names `f1f07f4` (E9.4, #44), not `3791779` (L2, #46) as the finding proposed.

**Why.** `3791779` holds the script, but `f1f07f4` later changed the code it runs. Every fault-set item passes through `Plane.write`, whose `evaluateWrite` and `decideWrite` that commit rewrote (grant-change rules). The card says to name a later commit in that case. Later commits touch none of the row's code: `dc8e9b6` added the oracle and dogfood report only, and `c89bdf8` changed none of the bench files fault-set.ts imports.

**Result.** The items carry `grants: []`, so the change does not alter the output, and the row reproduces on main's code (a274701d).

**Consequence.** If wrong, the cell names a later commit that produces the same bytes. A reader at either commit gets the same file.
