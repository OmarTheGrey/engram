---
date: 2026-11-28
author: claude-orchestrator
type: change
card: E9.16
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The MANIFEST rows card E9.16 added or regenerated (h1-crosswalk.json) now name 42cd1c50, the squash commit of its PR on main.

**Why.** The squash merge rewrote the branch's commits, so the cells named commits that are not ancestors of main.

**Result.** Each cell names a commit on main. No sha256 changed.

**Consequence.** The MANIFEST ancestry test holds.
