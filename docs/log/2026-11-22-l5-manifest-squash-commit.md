---
date: 2026-11-22
author: claude-orchestrator
type: change
card: L5
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/results/h3-near-duplicate.json
supersedes: none
---

**What.** The MANIFEST row of `research/results/h3-near-duplicate.json` names `8387b6a6`, card L5's squash commit on main (#105), in place of the branch commit `a3d403ea`.

**Why.** The squash merge left `a3d403ea` outside main's history, and the MANIFEST test requires each row's commit to be in it.

**Result.** The squash commit produces the same bytes, sha256 `f50c8f46`, so the row's hash is unchanged.

**Consequence.** `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` passes on main again.
