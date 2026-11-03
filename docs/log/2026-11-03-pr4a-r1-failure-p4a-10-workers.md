---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/scripts/results_io.py
  - research/tests/test_workers.py
  - docs/log/2026-11-03-pr4a-failure-test-repro-out-of-memory.md
supersedes: none
---

**What.** `make test-repro` ran out of memory in the H4 scripts' workers again, for the reviewer as for part A's first run, and part A logged it without a fix.

**Why.** `h4_power.py` and `h4_holm_levels.py` start one worker per core (32) whatever the machine's free memory, and the earlier entry only advised running when the machine is quiet. Found by the review (P4A-10).

**Result.** `workers()` in `research/scripts/results_io.py` caps the pool at `ENGRAM_RESEARCH_WORKERS` when set (a positive integer, else refused), documented on AGENTS.md's and CLAUDE.md's `make test-repro` line. `research/tests/test_workers.py` checks the cap, and that the power table and the Holm record are byte-identical with 1 worker and with 2 or 3 on small cases; a mutant ignoring the cap fails it.

**Consequence.** On a shared machine, `ENGRAM_RESEARCH_WORKERS=8 make test-repro`.
