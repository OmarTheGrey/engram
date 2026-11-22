---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.6
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/log/verify.ts
  - docs/log/2026-11-21-e1-5-finding-put-back-leak.md
supersedes: none
---

**What.** For the lead: a verified chain vouches for the log only; an erasure that verifies may still have left content in a store (E1.5-1, the sweep's put-back), and the projection and explanation tables are not chained.

**Why.** The card's brief asks that the chain not hide the put-back leak.

**Result.** Every report carries the note that the chain vouches for the log only and points at the deletion report and the dogfood report. An edited items row is not detected by verify; rebuild() and the replay invariant are what judge the projection.

**Consequence.** A later card could compare the projection with a rebuild in engram log verify.
