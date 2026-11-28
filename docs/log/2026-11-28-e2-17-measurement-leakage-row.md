---
date: 2026-11-28
author: claude-agent
type: measurement
card: E2.17
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - research/results/h1-leakage.json
  - research/results/MANIFEST.md
  - uv run python research/scripts/leakage.py --config research/configs/leakage.json --out research/results/h1-leakage.json
supersedes: none
---

**What.** The unregistered proof-of-concept row `research/results/h1-leakage.json` (card E8.16) moved, because this card adds the explain-absent route, the `explain --absent` command and the `memory_why_not` tool to the suites it counts. This is a proof of concept on a fixture workspace with no model, never a hypothesis result.

**Why.** The task asks for the new answer in E8.16's leak and parity suites, whose probe records the row counts.

**Result.** Probes 2,188 to 2,636, leaks 0, suite passed; HTTP denied-and-missing comparisons 377 to 428 (alike 275 to 326, the pinned characterisations unchanged), MCP 106 to 157 (alike 102 to 153); parity operations 13 to 14 per surface, all agreeing. After the review's fix pass the CLI and the TUI each add 102 denied-and-missing comparisons through explain --absent, all alike, with no characterisation. The row's sha256 is now a23b1a8478d7904e6e694f8986089b1e54501dd7036221e6ce816a0ff16de119.

**Consequence.** Every other MANIFEST row rerun alone kept its sha256.
