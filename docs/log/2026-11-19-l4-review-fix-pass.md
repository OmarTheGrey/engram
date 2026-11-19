---
date: 2026-11-19
author: claude-agent
type: change
card: L4
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - research/scripts/lint_scores.py
  - research/scripts/h3_lint_floor.py
  - research/tests/test_h3_lints.py
  - research/results/h3-lint-floor.json
supersedes: none
---

**What.** The review fix pass of PR #49: findings L4-1 to L4-7.

**Why.** An independent review recomputed the floor and found one critical defect and six smaller ones.

**Result.** Labels are credited only by the lints they name; unverified findings gain an `other_lint` part; the floor adds `natural_memory` and `by_construction.not_natural_precision`; five new tests, two mutations checked. The floor's numbers are unchanged and it regenerates to `354da571...` under `check_row`. Seven failure entries, five decisions (four superseding), and three superseding measurement and finding entries.

**Consequence.** The live delta's class cells cannot credit a lint built for another fault.
