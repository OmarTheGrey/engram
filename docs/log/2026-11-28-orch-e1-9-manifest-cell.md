---
date: 2026-11-28
author: claude-orchestrator
type: change
card: E1.9
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The MANIFEST rows card E1.9 added or regenerated (h1-gate-mutation-audit.json) now name b85f4c78, the squash commit of its PR on main.

**Why.** The squash merge rewrote the branch's commits, so the cells named commits that are not ancestors of main.

**Result.** Each cell names a commit on main. No sha256 changed.

**Consequence.** The MANIFEST ancestry test holds.
