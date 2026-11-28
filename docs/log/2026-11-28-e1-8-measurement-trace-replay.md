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
supersedes: none
---

**What.** The replay of the 200 committed traces as a results row; a proof of concept on the model's own bounded traces, model-free, never a hypothesis result.

**Why.** The lead asked that measurements showing the system working be reproducible results.

**Result.** From the MANIFEST row's file: 183 of 200 traces replay to their end; 11,533 of 12,000 steps matched, 8,927 states compared. The 17 that diverge are each explained by a finding: E18-F1 12, E18-F2 3, E18-F6 1, E18-F7 1; none unexplained.

**Consequence.** The test pins each trace's outcome to this file, so a change in the code's behaviour moves the row on purpose.
