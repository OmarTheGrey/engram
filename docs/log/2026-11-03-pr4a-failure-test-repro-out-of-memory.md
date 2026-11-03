---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/results/MANIFEST.md
  - research/scripts/h4_power.py
  - research/scripts/h4_holm_levels.py
  - "make test-repro"
supersedes: none
---

**What.** The first `make test-repro` on this branch reproduced 5 of 7 results; `h4_power.py` and `h4_holm_levels.py` exited with 1.

**Why.** Each raised numpy's `_ArrayMemoryError` in a worker process ("Unable to allocate 8.95 MiB", then "25.4 MiB"): both scripts start one worker per core (32), and the machine had 0.9 GB of 31.7 GB free while other worktrees ran their own jobs. Nothing in either script or its data was at fault.

**Result.** Rerun one at a time from the same commit with nothing else of this PR running, both regenerated their MANIFEST sha256 exactly: `h4-power.json` `852a6776...` in 763 s, `h4-holm-levels.json` `dcacf0c9...` in 746 s. A second full `make test-repro` was then started; the PR body gives its outcome.

**Consequence.** On a shared machine, run `make test-repro` when no other worker pool is running; a worker-count limit for the two H4 scripts is a possible follow-up.
