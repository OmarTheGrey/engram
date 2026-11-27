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
  - docs/log/2026-11-26-x21-decision-count-on-every-rate.md
supersedes: docs/log/2026-11-26-x21-decision-count-on-every-rate.md
---

**What.** `capped_utility` is written in two places: in every rate entry, as before, and also in each `mgs` entry beside U, per model and condition. The coordinator made this decision in the review's fix pass (finding 1).

**Why.** Card X20, running in parallel, writes `utility_exclusions` in `mgs`. Both are counts of sessions that left U, so they sit together beside U. The rates key stays because the card asks for the count next to `exclusions`. The two counts are the same number, from one helper (`_capped_utility`), keyed by benchmark, model and condition over the store's sessions.

**Result.** `test_the_table_counts_the_capped_utility_sessions_per_arm_and_condition` checks the `mgs` counts (2, 1, and 1 for a second model), and the planted CLI run checks 1 in both places. Every other `mgs` field is unchanged.

**Consequence.** After X20 merges, readers find every count of sessions out of U in `mgs`.
