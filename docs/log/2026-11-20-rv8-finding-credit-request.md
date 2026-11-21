---
date: 2026-11-20
author: claude-agent
type: finding
card: RV8
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/results/h2-cost-table.json
  - research/configs/openrouter-prices.json
supersedes: none
---

**What.** On the lead's set with the 20 November decisions applied, H1 costs 274 to 1,691 dollars, H3 57 to 758 and H4 67 to 417; the three together 398 to 2,866.

**Why.** The lead will request a 1,000 dollar credit for H1 first, a start on H3 and H4, and a reserve.

**Result.** The low estimate fits, with 602 dollars left. The high does not: H1's high alone is 1,691 (ceiling 2,114), of which 439 is the 1,024 reasoning tokens a call the high estimate assumes; without them H1 is about 1,252, still above 1,000. The orchestrator's rough 274 to 1,252 matches H1's low and its high without reasoning tokens. All kept runs: 1,209 to 7,178.

**Consequence.** 1,000 dollars covers H1's low to middle range, not its high plus a start. Set `spend_ceiling_usd` to the credit, not 1.25 times the high; a run stops there and resumes (RV1).
