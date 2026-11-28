---
date: 2026-11-28
author: claude-agent
type: failure
card: X17
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/reproduce.py
  - research/results/MANIFEST.md
  - research/results/h1-cost.json
supersedes: none
---

**What.** Rerunning the row `research/results/h1-cost.json` through `make test-repro`'s check failed in the fresh worktree under `ENGRAM_OFFLINE=1`.

**Why.** The script needs GateMem's pinned data in `.engram/upstream`, which a fresh worktree lacks, and the offline flag forbids its fetch; the next row's script, `h1_check_runs_cost.py`, fetched it at the pin a983828 during its own run.

**Result.** Rerun once the data was present, both rows reproduce: `h1-cost.json` at f147daf7 and `h1-check-runs-cost.json` at fd5a2507, their MANIFEST sha256. Neither is reachable from this card's change; they were rerun only to check `test-repro`'s loop, which the page's check now follows.

**Consequence.** None: rows needing pinned data must have it fetched before an offline rerun, as the addendum says.
