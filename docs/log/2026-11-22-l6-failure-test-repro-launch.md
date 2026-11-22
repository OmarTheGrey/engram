---
date: 2026-11-22
author: claude-agent
type: failure
card: L6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/scripts/reproduce.py
  - "make test-repro"
supersedes: none
---

**What.** `make test-repro`, run for the card's acceptance ("make test-repro unchanged"), failed twice on this machine for reasons other than the bytes.

**Why.** The machine was shared with other agents' runs. In the first run, 18 scripts failed to start (exit 3221225794, 0xC0000142, a Windows process-launch failure). In the second, a SIGTERM (exit 143) killed make, then a process pool, then `frontier_axes.py`, which needs more than 35 minutes under that load.

**Result.** No row reported a differing sha256. Across the two runs and the scripts rerun row by row through `reproduce.check_row`, all 21 MANIFEST rows reproduced byte for byte; `frontier_axes.py` alone, given 100 minutes, took about an hour. The branch changes nothing under `research/` or `fixtures/` and no read path.

**Consequence.** The acceptance's "make test-repro unchanged" holds row by row. A single `make test-repro` under this load needs a longer cap than 40 minutes.
