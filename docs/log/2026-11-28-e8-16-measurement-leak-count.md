---
date: 2026-11-28
author: claude-agent
type: measurement
card: E8.16
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-leakage.json
  - research/results/MANIFEST.md
  - research/configs/leakage.json
  - uv run python research/scripts/leakage.py --config research/configs/leakage.json --out research/results/h1-leakage.json
supersedes: none
---

**What.** The zero-leak count as a reproducible result, a proof of concept on a fixture workspace with no model, never a hypothesis result: research/scripts/leakage.py runs the four suites and counts their records into `research/results/h1-leakage.json` (MANIFEST row, commit 9c57164d).

**Why.** The lead's request of 2026-11-28 that a measurement showing the system working be a result with a register section.

**Result.** 13 canaries written; 2,221 probes (HTTP 728, MCP 288, CLI 576, TUI 581, pi 48); 0 leaks; 12 denied-and-missing comparisons over HTTP, 8 alike, 4 characterised; parity 13 of 13 on each user surface and 5 of 5 on MCP and pi; `suite_passed` true. Two runs gave sha256 2b7554d9...dca85.

**Consequence.** Registered in the results register under the new status proof of concept.
