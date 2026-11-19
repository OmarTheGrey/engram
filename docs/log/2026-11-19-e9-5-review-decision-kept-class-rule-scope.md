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
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** The rules that an added grant be of the item's class and unexpired, and that a class change keep no grant of another class, apply to rewrites and updates, not to a promotion's new version or a first write.

**Why.** ADR 0034 holds a first write and a promotion apart (its review finding M1: a first write may carry an expired or other-class grant, and a promotion's new version may carry its source's grants); applying the rules there would flag what the plane is meant to allow, against E95-4.

**Result.** The real-Plane promotion test gives 0; a handover changing class with a kept grant gives 1.

**Consequence.** If the lead settles the backlog row "Promotion carries grants" the other way, the rule extends to promotions.
