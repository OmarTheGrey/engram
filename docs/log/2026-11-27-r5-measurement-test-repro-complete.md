---
date: 2026-11-27
author: claude-agent
type: measurement
card: R5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - "make test-one T=<each failing file>"
  - "uv run pytest research"
supersedes: none
---

# R5: the last two MANIFEST rows reproduce, and the gate's failures were load

**What.** On a quiet machine the orchestrator reran the two rows the shared machine stopped, each alone through `reproduce.check_row`: `h4-holm-levels.json` with one worker (ok, `dcacf0c9...45d4`) and `h2-frontier-axes.json` with four workers and no time limit (ok, `5f208b78...180f`). A first frontier-axes rerun was killed at its one-hour limit, after GateMem finished. The 13 test files that failed in the gate run on 2026-11-26 were rerun together: 162 of 162 pass. `uv run pytest research`: 561 passed.

**Why.** Two rows had not finished on 2026-11-26 (`docs/log/2026-11-26-r5-failure-test-repro-load.md`), so R5's acceptance was not yet shown.

**Result.** All 24 rows match: the two label-audit rows at their new hashes, the other 22 at their committed ones.

**Consequence.** R5's acceptance holds in full; it merges.
