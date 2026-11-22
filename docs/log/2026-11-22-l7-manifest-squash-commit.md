---
date: 2026-11-22
author: claude-orchestrator
type: change
card: L7
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/results/h3-lint-nli.json
supersedes: none
---

**What.** The MANIFEST row of `research/results/h3-lint-nli.json` names `030a7fba`, card L7's squash commit on main (#109), in place of the branch commit `434412c1`.

**Why.** The squash merge left `434412c1` outside main's history, and the MANIFEST test requires each row's commit to be in it.

**Result.** The squash commit holds the same bytes, sha256 `22e3c122`, so the row's hash is unchanged.

**Consequence.** The MANIFEST history test passes on main again.
