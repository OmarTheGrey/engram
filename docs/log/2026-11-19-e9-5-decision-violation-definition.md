---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** A violation is a read that returned an item missing, not active, or not `readable` by its reader at the read's time in the oracle's replay of the events before it, or an allowed event that changed what an item's grants admit and that `grantChangePermitted` refuses.

**Why.** The plan named the two kinds but not how each is judged. Invariant 5's grant walk judges reads by existence, status and `readable`, and grant changes by owner and operation; the report follows it and adds a write's source.

**Result.** A first write carrying grants counts as a change, judged by the owner it names (ADR 0006); a promotion is compared with its source. The validity window is not checked: it is a read filter, not an access rule.

**Consequence.** A read the plane filtered correctly but outside its validity window is not a violation.
