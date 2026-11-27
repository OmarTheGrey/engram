---
date: 2026-11-26
author: claude-agent
type: failure
card: X20
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - make test-repro
  - research/scripts/h4_holm_levels.py
supersedes: none
---

**What.** The first `make test-repro` (at 84c828cc, four research workers, a 3,000 second timeout) did not finish: 10 of 25 rows reproduced, `h4_holm_levels.py` exited 1, and the timeout stopped it inside `h2_longmemeval_ttl.py`.

**Why.** numpy raised `_ArrayMemoryError: Unable to allocate 19.5 MiB for an array with shape (932, 2742)` in an H4 worker while the shared machine was loaded. The H4 script does not reach the runner. The timeout was too short for the full manifest under load.

**Result.** The ten rows that ran all matched their sha256. The proof was rerun at the branch's final head with fewer workers and a longer timeout (see the report and PR.md).

**Consequence.** Run test-repro with `ENGRAM_RESEARCH_WORKERS=2` and no short timeout on this machine.
