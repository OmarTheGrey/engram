---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
supersedes: none
---

**What.** The reworked model's erasure check failed on a correct log: `[twin, write(dana, new person:dana #0), promote(hr, #0, to role:release, review), write(lee, live #0), offboard(crash report)]`.

**Why.** The check excluded from "erased content" only what a surviving item holds now. HR's promotion copied Dana's note into a new role item before the offboarding, and Lee then rewrote that item, so the note lived on only in the role item's earlier version in the log, which is not erased content.

**Result.** Content is erased-only unless an allowed event of any item not erased held it. The vacuity and mutation checks still fail as before (a gate ignoring an open erasure is caught in three commands).

**Consequence.** None beyond the fix.
