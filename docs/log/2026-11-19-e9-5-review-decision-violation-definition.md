---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/src/dogfood.ts
supersedes: docs/log/2026-11-19-e9-5-decision-violation-definition.md
---

**What.** A violation is a read that returned an item missing, not active, not `readable` or outside its validity window, or an allowed event that changed what an item's grants admit and for which `grantChangeProblem` names a problem.

**Why.** The review pass widened both kinds (E95-1 to E95-4, E95-6).

**Result.** `grantChangeProblem` judges who widened, what was added and carried, the write gate's reading of a write, and a grant change's item and fields; the report keeps `grantsChanged` as the trigger.

**Consequence.** Supersedes the first pass's definition.
