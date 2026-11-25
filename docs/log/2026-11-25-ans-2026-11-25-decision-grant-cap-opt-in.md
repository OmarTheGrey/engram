---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/tasks/absorb-plan-2.md
  - docs/tasks/lead-decisions.md
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** ADR 0034's grant cap stays opt-in until the thesis runs are done (question 5, card E2.21).

**Why.** The lead answered question 5 of `docs/tasks/absorb-plan-2.md`, section 8, himself on 2026-11-25: his own answer, not one under the delegation.

**Result.** `grants.expiry_cap`, which card E2.21's part 2 adds, is on in the twin and knowledge profiles only and never in a registered preset. H2 to H4 run under H1's policy. As a default, the cap would refuse 1,633 of 2,490 GateMem fixture writes (their `OPEN_END` grants), and H2 to H4's GateMem cells would then run under a policy other than H1's. Decisions 3 and 6 of ADR 0034 are unchanged: they state the rule the option turns on.

**Consequence.** E2.21's part 2 sets the option in the two profiles. ADR 0034's acceptance note records the answer.
