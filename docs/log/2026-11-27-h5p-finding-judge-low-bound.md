---
date: 2026-11-27
author: claude-agent
type: finding
card: H5P
chapter: limitations
pillar: distill
hypothesis: H5
evidence:
  - research/results/h2-cost-table.json
  - docs/research/preregistration.md
supersedes: none
---

**What.** The draft's low cost bound counts a judge call for every retail training and replay session, not only for tasks with natural-language assertions.

**Why.** Rechecking the arithmetic, the low total of 84.58 dollars matches only with 367 judge calls (148 retail training, 120 retail replay at 8 candidates, 99 evaluation).

**Result.** Counting the 99 evaluation calls alone gives 83.30 billed and 55.64 ledger dollars at the low end; the difference is about 1.29 dollars. The high end is unaffected.

**Consequence.** None for the draft, which now calls it an upper count: the low bound errs high by at most 1.29 dollars, and `COUNT=1` replaces it.
