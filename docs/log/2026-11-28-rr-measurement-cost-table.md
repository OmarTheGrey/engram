---
date: 2026-11-28
author: claude-agent
type: measurement
card: none
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h2-cost-table.json
  - research/configs/cost-table.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/cost_table.py --config research/configs/cost-table.json --out research/results/h2-cost-table.json"
supersedes: docs/log/2026-11-21-rv8-review-measurement-cost-table-reasoning-off.md
---

**What.** The cost estimate over every registered run, restated with its config as its own evidence item.

**Why.** The superseded entry named the config only inside its command, so the thesis consolidator rejects it; its numbers still match the file.

**Result.** At OpenRouter list prices, as decided (`decided.totals.openrouter-prices.d-lead`, reasoning off): 1,159.482346 to 5,227.072575 dollars, ceiling 6,533.840719, 348,842 to 660,296 calls; H1 274.334574 to 1,251.921395, H2 647.284117 to 2,154.077676. With the reasoning allowance (`decided.totals_with_allowance`, a sensitivity): high 6,855.544936, ceiling 8,569.43117. As registered (`totals.openrouter-prices.1d-lead/2a/47c`): 1,393.601368 to 11,990.220411, ceiling 14,987.775514. These are estimates; no model was called.

**Consequence.** The reasoning-off figure stays the planning figure; list prices are read again on the day of a run.
