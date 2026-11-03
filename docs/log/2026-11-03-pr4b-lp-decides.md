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
supersedes: none
---

**What.** v1, item 14 and section 7 describe the gate-by-action table as part A's last polish built it.

**Why.** Part A made `decides` a boolean in every H1 table, set from the config's `gate_by_action`, removed the gate-by-action table's decision block, and stopped `make h1-table GATE_BY_ACTION=1` writing the readings template.

**Result.** The texts now say: `"decides": true` in the main table and `false` in the gate-by-action table, which carries no `primary`, `holm` or `decision` block, only rates, contrasts (C4 minus C5 with a p-value, for reference), sets, sensitivity table and MGS; only the main run writes the template and its key. Item 14's alternative of deciding on Eqs. 11 and 12 now needs the table code changed, since `decides` follows `gate_by_action`.

**Consequence.** Item 14's recommendation is unchanged, so its entry stands.
