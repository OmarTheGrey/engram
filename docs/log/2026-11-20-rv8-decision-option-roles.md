---
date: 2026-11-20
author: claude-agent
type: decision
card: RV8
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/configs/cost-table.json
supersedes: none
---

**What.** Item 1's options (b) and (c) are priced with the roles filled as follows: (b) keeps the three models of (a) and swaps M1 with DeepSeek's or Mistral's slot; (c) prices gpt-6-luna and mistral-small-2603 as M1 with M2 and M3 as in (a).

**Why.** Item 1 names only M1 for (b) and no model for (c); M2 and M3 must come from three makers.

**Result.** Five option sets in `options.item_1`; any other set is one entry in the config.

**Consequence.** If the lead picks other models for M2 and M3, add their prices to `openrouter-prices.json` and an option; the table regenerates.
