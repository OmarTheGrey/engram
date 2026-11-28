---
date: 2026-11-28
author: claude-agent
type: measurement
card: E1.8
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-quint-trace-replay.json
  - research/configs/quint-trace-replay.json
  - research/scripts/quint_trace_replay.py
  - research/results/MANIFEST.md
  - "uv run python research/scripts/quint_trace_replay.py --config research/configs/quint-trace-replay.json --out research/results/h1-quint-trace-replay.json"
supersedes: docs/log/2026-11-28-e1-8-measurement-trace-replay.md
---

**What.** The trace replay's row rerun after the review: item status compared, every plane event but retractions in the trail, divergences attributed by item, step and kind. A proof of concept on the model's own bounded traces, model-free, never a hypothesis result.

**Why.** The first row counted retired items as live and attributed by any mark in the trace, which overstated it.

**Result.** From the MANIFEST row's file: 144 of 200 traces replay to their end; 10,183 of 12,000 steps matched, 7,783 states compared. The 56 that diverge each carry, at or before the diverging step and about its item, a mark of a finding: E18-F1 51, E18-F2 3, E18-F6 1, E18-F7 1; none unexplained.

**Consequence.** Retraction (E18-F1) is the main gap between code and model; card E1.7 decides whether the code or the model moves.
