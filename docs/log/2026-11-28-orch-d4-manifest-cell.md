---
date: 2026-11-28
author: claude-orchestrator
type: change
card: D4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The MANIFEST rows card D4 added or regenerated (h1-crosswalk.json, h1-drift-fixture.json) now name 2c3503b9, the squash commit of its PR on main.

**Why.** The squash merge rewrote the branch's commits, so the cells named commits that are not ancestors of main.

**Result.** Each cell names a commit on main. No sha256 changed.

**Consequence.** The MANIFEST ancestry test holds.
