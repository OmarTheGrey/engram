---
date: 2026-11-21
author: claude-orchestrator
type: change
card: RV8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The four MANIFEST rows card RV8 added (h1-label-audit, h2-label-audit-longmemeval, h2-cost-table and h2-frontier-axes) now name 03d5a76, the squash commit of PR #65 on main.

**Why.** A squash merge rewrites a branch's commits, so after the merge the cells named commits that are not ancestors of main, and the MANIFEST ancestry test failed. This is the same follow-up as PR #64 for RV6.

**Result.** Each cell names a commit on main. No sha256 changed.

**Consequence.** Until the ancestry test accepts a PR's own merge commit, every PR that adds a MANIFEST row needs this follow-up.
