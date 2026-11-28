---
date: 2026-11-28
author: claude-orchestrator
type: change
card: E0.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The h1-crosswalk MANIFEST row card E0.7 regenerated now names 686e0ee, the squash commit of PR #132 on main.

**Why.** The squash merge rewrote the branch's commits, so the cell named a commit that is not an ancestor of main.

**Result.** The cell names a commit on main. No sha256 changed.

**Consequence.** The MANIFEST ancestry test holds on main and on every branch that merges it.
