---
date: 2026-11-20
author: claude-agent
type: measurement
card: RV8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/h2-cost-table.json
  - "uv run python research/scripts/cost_table.py --config research/configs/cost-table.json --out research/results/h2-cost-table.json"
supersedes: docs/log/2026-11-20-rv8-measurement-cost-table.md
---

**What.** The cost table again (MANIFEST row research/results/h2-cost-table.json), at the second fetch of OpenRouter's list on 2026-11-20, with the lead's set as option `d-lead` and a `decided` block applying the delegated decisions.

**Why.** The lead chose M1 DeepSeek v4 pro, M2 GLM 5.3 Flash, M3 Mistral Large 4; the first fetch priced DeepSeek at 0.22 and 9.5, the list now says 1.32 and 3.96.

**Result.** As registered (`totals`, `1d-lead/2a/47c`): 1,443 to 12,313 dollars, ceiling 15,391, 448,403 to 877,385 calls. As decided (`decided.totals`, `d-lead`): 1,209 to 7,178, ceiling 8,973, 369,092 to 707,546 calls. Per hypothesis as decided: H1 274 to 1,691, H2 647 to 2,765, H3 57 to 758, H4 67 to 417, H5 164 to 1,547.

**Consequence.** The old totals (option a on terra) stay as the comparison; the lead's set is the planning figure.
