---
date: 2026-11-28
author: claude-agent
type: failure
card: L9
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/scripts/h3_fault_set.py
supersedes: none
---

**What.** The first guard rerun of the h3-lint-floor row exited 1.

**Why.** `.engram/upstream/longmemeval/data/longmemeval_s_cleaned.json` was missing from this worktree, and ENGRAM_OFFLINE=1 forbids the fetch.

**Result.** The pinned file was copied from the r5-on-stop-drop worktree's `.engram/upstream/` (data only), as the addendum says, and the row was rerun (see the guard finding).

**Consequence.** None.
