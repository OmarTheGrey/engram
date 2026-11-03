---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/scripts/results_io.py
  - AGENTS.md
supersedes: none
---

**What.** The worker cap is an environment variable, `ENGRAM_RESEARCH_WORKERS`, read by `workers()` in `research/scripts/results_io.py`, not a config field.

**Why.** The review (P4A-10) allowed either. The worker count is a property of the machine, not of the experiment: a config field would enter the config the result is regenerated from, and `make test-repro` passes only `--config` and `--out`, so every machine would rerun with the committer's count.

**Result.** The two H4 scripts use it; the other scripts start at most three node processes and are left alone. Unset, the count is one per core, as before, so the committed results are unchanged.

**Consequence.** If a future script's result depended on its worker count, this cap would hide it; `test_workers.py` guards the two that use it.
