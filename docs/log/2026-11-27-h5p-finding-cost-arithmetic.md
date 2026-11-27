---
date: 2026-11-27
author: claude-agent
type: finding
card: H5P
chapter: evaluation
pillar: distill
hypothesis: H5
evidence:
  - research/results/h2-cost-table.json
  - research/configs/openrouter-prices.json
  - docs/research/preregistration.md
supersedes: none
---

**What.** The draft's H5 cost bounds are the cost table's per-session dollars times the draft's counts.

**Why.** The draft says the arithmetic is in card H5P's log, and the cost table's H5 rows predate item 63.

**Result.** Per session, each row's `dollars_decided` over its sessions: agent 27.536256/492 and 223.407304/492, user 13.69728/492 and 146.943963/492, judge 1.6416/342 and 6.566398/342, induction 4.8708/492 and 21.215035/492. Sessions 988 low, 1,348 high; judge calls 367 and 547; induction 2 and 52. Billed: 84.58 to 1,027.45; with 1,024 reasoning tokens per agent and induction call at 3.96 dollars per million, 1,136.98. Ledger, M1 at half its list price and gpt-4.1 at its list price (an unrecorded ratio of 1.0): 56.93 to 720.28.

**Consequence.** The cost table computes the ceiling once gpt-4.1's ratio is recorded; `COUNT=1` replaces the bounds.
