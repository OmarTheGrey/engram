---
date: 2026-11-28
author: claude-orchestrator
type: change
card: E2.17
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The MANIFEST rows card E2.17 added or regenerated (h1-leakage.json) now name f0bcad2b, the squash commit of its PR on main.

**Why.** The squash merge rewrote the branch's commits, so the cells named commits that are not ancestors of main.

**Result.** Each cell names a commit on main. No sha256 changed.

**Consequence.** The MANIFEST ancestry test holds.
