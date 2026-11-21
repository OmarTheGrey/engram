---
date: 2026-11-21
author: claude-agent
type: failure
card: RV8
chapter: results
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-frontier-axes.json
  - docs/log/2026-11-20-rv8-finding-flat-axes.md
supersedes: none
---

**What.** The finding on flat axes said no single tested axis moves both benchmarks at a non-degenerate value (review finding RV8-3).

**Why.** I read the table by its flat or moving flag and its one degenerate axis, and did not count what the moving values move.

**Result.** The result shows ttl and budget moving both benchmarks at several values: ttl of 1 day moves 306 GateMem checkpoints and removes 32 leak targets from the read, so the claim was wrong.

**Consequence.** A superseding finding states the axes quantitatively; the script writes no prose, so nothing was regenerated.
