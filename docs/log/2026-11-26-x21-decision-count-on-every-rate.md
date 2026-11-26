---
date: 2026-11-26
author: claude-agent
type: decision
card: X21
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_exclusions.py
supersedes: none
---

**What.** `capped_utility` is a key of every rate entry the table writes, both arms, the main rates and each secondary set's and the sensitivity table's, counted over the store's utility sessions of that benchmark, model and condition; it is not written in `mgs`.

**Why.** The card asks for the count per arm and condition, zero included, next to `exclusions`, which lives in the rate entries. Utility sessions belong to no set, so the count is the same in every set's rates; writing it everywhere keeps every rate entry one shape. On MEM-INV-Bench it is always zero: that arm has no utility sessions, and its capped sessions are already counted in `exclusions` under "turn limit" (out of scope by the card).

**Result.** `test_every_rate_names_its_capped_utility_count_zero_included` holds the zeros.

**Consequence.** If the lead wants it beside U in `mgs` instead, it moves in one line; no other output reads the key.
