---
date: 2026-11-27
author: claude-agent
type: failure
card: RD1
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/scripts/frontier_axes.py
  - research/results/MANIFEST.md
  - docs/log/2026-11-25-rd1-milestone-paused.md
supersedes: none
---

**What.** On 2026-11-25 the rerun of `h2-frontier-axes.json` under `make test-repro` was cut by the agent's own 90-minute timeout (exit 143), and its second run was stopped for the pause.

**Why.** The frontier-axes script replays GateMem and LongMemEval across every axis, on a machine shared with about ten agents; 90 minutes was too short for it under that load. The timeout was the agent's choice, not the script's.

**Result.** No sha256 was compared for that row; the other 23 rows matched. Recorded inside the pause milestone at the time, and separately here as rule 14 asks.

**Consequence.** The orchestrator reruns the row serially with no short timeout: `ENGRAM_RESEARCH_WORKERS=4 uv run python research/scripts/frontier_axes.py --config research/configs/frontier-axes.json --out <tmp>/h2-frontier-axes.json`, then compares its sha256 with the MANIFEST row.
