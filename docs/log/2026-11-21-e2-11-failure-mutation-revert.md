---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
supersedes: none
---

**What.** A round of mutation checks restored files with `git checkout -- packages/core/src`, which also reverted the uncommitted oracle changes.

**Why.** The mutation script restored the whole folder rather than the one file it changed.

**Result.** Five of six invariant 8 mutation runs failed with `floorProblem is not a function`, not for the mutation. The oracle edit was reapplied, committed, and every mutation rerun restoring only its own file.

**Consequence.** Commit before mutating; restore one file.
