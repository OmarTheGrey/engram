---
date: 2026-11-27
author: claude-orchestrator
type: change
card: R5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The two MANIFEST rows card R5 regenerated (h1-label-audit and h2-label-audit-longmemeval) now name 6881e46, the squash commit of PR #118 on main.

**Why.** The squash merge rewrote the branch's commits, so the cells named a commit that is not an ancestor of main. This is the same follow-up as PR #68 for RV8.

**Result.** Each cell names a commit on main. No sha256 changed.

**Consequence.** The MANIFEST ancestry test holds on main.
