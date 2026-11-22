---
date: 2026-11-22
author: claude-orchestrator
type: change
card: X14
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/results/h1-redteam.json
supersedes: none
---

**What.** The MANIFEST row of `research/results/h1-redteam.json` names `fe05b8a3`, card X14's squash commit on main (#107), in place of the branch commit `17f13098`.

**Why.** The squash merge left `17f13098` outside main's history, and the MANIFEST test requires each row's commit to be in it.

**Result.** The squash commit holds the same bytes, sha256 `c1e73f53`, so the row's hash is unchanged.

**Consequence.** The MANIFEST history test passes on main again.
