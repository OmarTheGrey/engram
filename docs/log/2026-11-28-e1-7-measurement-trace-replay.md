---
date: 2026-11-28
author: claude-agent
type: measurement
card: E1.7
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-quint-trace-replay.json
  - research/configs/quint-trace-replay.json
  - research/scripts/quint_trace_replay.py
  - research/results/MANIFEST.md
  - "uv run python research/scripts/quint_trace_replay.py --config research/configs/quint-trace-replay.json --out research/results/h1-quint-trace-replay.json"
supersedes: docs/log/2026-11-28-e1-8-measurement-trace-replay-status.md
---

**What.** The trace replay's row rerun after the fix, on 200 traces `make verify-spec` regenerated from the changed model (seed 1; a second run of the target gave the same bytes). A proof of concept on the model's own bounded traces, never a hypothesis result.

**Why.** The card moves this unregistered row on purpose: the code and the model both changed.

**Result.** From the MANIFEST row's file (sha256 b1ef437d..., commit 73dd0d02): 199 of 200 traces replay to their end; 11,951 of 12,000 steps matched, 9,298 states compared. The one other (replay-068, step 12) is explained by E18-F3; none unexplained. Before the fix 144 of 200 did, 51 of the rest by E18-F1. Both gap scenarios and the three closed findings' scenarios replay to their end.

**Consequence.** The open differences are E18-F3, F5, F6, F7 and F8, each pinned by its scenario.
