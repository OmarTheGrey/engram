---
date: 2026-11-28
author: claude-orchestrator
type: decision
card: D4
chapter: design
pillar: distill
hypothesis: none
evidence:
  - docs/decisions/0050-drift-revalidates-on-environment-change.md
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** ADR 0050 (card D4: a changed environment hash re-validates an admitted procedure; drift retires on the success floor after min-trials) is accepted under the lead's delegation, superseding only ADR 0011's sentence on the environment hash.

**Why.** The lead's answer of 2026-11-28 allows new ADRs as needed, none contradicting the set. The independent review of card D4 checked it against ADRs 0011, 0045 and 0046, and the fix pass wrote it as a superseding ADR, as ADR 0011 requires for a change to its decision. The index admits no proposed ADR.

**Result.** Index row and Status line read accepted under the delegation; the lead may overturn it.

**Consequence.** Card E9.11's ADR takes the next free number at its merge, not 0050.
