---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - docs/research/prereg-v1-decisions.md
  - docs/tasks/prereg-v1-plan.md
  - research/analysis/h1.py
  - research/analysis/equivalence.py
supersedes: none
---

**What.** Part B's final-round text now uses part A's exact names and rules, checked in the code at `7730f30`, and section 7's offline checks were rerun on that head.

**Why.** The orchestrator rebased part B onto part A's final fixes and sent the names to check against.

**Result.** Changed: MGS's U is the share of utility checkpoints the judge finds complete (`utility_ok`), and in the gate-by-action table also needs the right action, with a percentile interval (`mgs`); `read_before_action` is a `memory_read` result reaching the model before its reply, excluded sessions counted; the audit records `rejected`, `stop_share` and `stop` (null until both key sheets exist), strictly more than 10 percent; item 13h names `complete_item_differences`; `READINGS=` writes no template. `fr-decision-utility-checkpoints`, unmerged, was corrected in place for U.

**Consequence.** Both h1-table commands stop at the converter offline, as recorded.
