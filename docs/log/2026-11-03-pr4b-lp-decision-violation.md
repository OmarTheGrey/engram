---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-03-pr4b-fr-decision-violation.md
---

**What.** Recommended, for the lead's decision: GateMem's leak without the wrong action in the primary table, the paper's Eqs. 11 and 12 in the gate-by-action table, MEM-INV-Bench as upstream scores it (decision sheet item 14), restated.

**Why.** the last verification of PR #27: Eq. 11 counts a wrong action in A and Eq. 12 in F, so naming Eq. 11 alone left F out (F-7); each table now records whether it decides H1; MGS's U follows item 20; and the Evidence cited three superseded entries (F-4).

**Result.** The primary table carries `"decides": true`, the gate-by-action table `false`. Item 14 cites the chain heads `2026-11-03-pr4-f2-decision-violation`, `2026-11-03-pr4-decision-blind-kit-design` and `2026-11-03-pr4b-fr-decision-unread-not-shown`.

**Consequence.** No recommendation in item 14 changed but MGS's U, which is item 20's.
