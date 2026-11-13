---
date: 2026-11-06
author: claude-agent
type: failure
card: L1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/scripts/faults.ts
  - "make fault-workspace FAULT=orphan.flag"
supersedes: none
---

**What.** The first fault workspace was refused by `engram lint`: the policy loader reported no read matrix row for role and org.

**Why.** The fixture policy copied the unit tests' policy, whose matrix has rows for person and team only; the Plane accepts that, but `parsePolicy` requires a row for every level.

**Result.** The fixture policy now has a row per level, and the twelve fixtures were regenerated from the script.

**Consequence.** Fixture policies are written to pass the loader, since the CLI reads them.
