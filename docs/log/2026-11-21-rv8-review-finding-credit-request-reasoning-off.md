---
date: 2026-11-21
author: claude-agent
type: finding
card: RV8
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h2-cost-table.json
  - docs/log/2026-11-20-rv8-finding-credit-request.md
supersedes: docs/log/2026-11-20-rv8-finding-credit-request.md
---

**What.** On the lead's set with reasoning off, H1 costs 274 to 1,252 dollars, H3 57 to 347 and H4 18 to 75; the three together 349 to 1,674.

**Why.** The lead will request a 1,000 dollar credit for H1 first, a start on H3 and H4, and a reserve.

**Result.** The low estimate fits with 651 dollars left. H1's high (1,252, ceiling 1,565) is above 1,000, as the earlier entry found, but the 1,691 it gave included 439 dollars of reasoning tokens the decision removes. All kept runs: 1,159 to 5,227 (with the allowance, as a sensitivity, 6,856).

**Consequence.** 1,000 dollars covers H1's low to middle range, not its high plus a start. Set `spend_ceiling_usd` to the credit; a run stops there and resumes (RV1).
