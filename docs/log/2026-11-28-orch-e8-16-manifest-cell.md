---
date: 2026-11-28
author: claude-orchestrator
type: change
card: E8.16
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The h1-leakage MANIFEST row card E8.16 added now names 3018f629, the squash commit of its PR on main.

**Why.** The squash merge rewrote the branch's commits, so the cell named a commit that is not an ancestor of main.

**Result.** The cell names a commit on main. No sha256 changed.

**Consequence.** The MANIFEST ancestry test holds.
