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
supersedes: docs/log/2026-11-28-e8-16-measurement-leak-count.md
---

**What.** The leak count regenerated after the review, a proof of concept on a fixture workspace with no model, never a hypothesis result (MANIFEST row, commit 424e271c, sha256 bc5c43f6...798fa, the same on two runs).

**Why.** The review's fixes changed what is probed and compared.

**Result.** 13 canaries; 2,188 probes by the four probe actors (HTTP 696, MCP 288, CLI 576, TUI 580, pi 48), 0 leaks; the control's and the erasing member's 559 apart, 0 leaks; denied and missing: HTTP 377 compared, 275 alike, 102 pinned (write 47, checkWrite 47, explain 4, read counts 4), MCP 106, 102 alike; parity 13 of 13 on each user surface, 5 of 5 on MCP, the HTTP API (model) and pi; `suite_passed` true.

**Consequence.** The register section reads the new file. The MANIFEST commit names a branch commit; rewrite it to the squash commit after merge, as for the crosswalk row.
