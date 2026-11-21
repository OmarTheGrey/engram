---
date: 2026-11-21
author: claude-agent
type: change
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/research/baselines.md
  - docs/tasks/L5.md
  - docs/tasks/X14.md
  - docs/tasks/absorb-plan.md
supersedes: docs/log/2026-11-21-r2-change-proposed-arms.md
---

**What.** Card R2's review fix pass, after rebasing onto the answers branch's fix pass. It fixed six important findings (R2-1 to R2-6) and seven minor ones (R2-7 to R2-13).

**Why.** The review found switches already on in registered presets, a replay core cannot do, a tag confound, decided retention counted as residue, an overclaim about Letta, and EvalMem's unpinned generation calls.

**Result.** The section now has five scheduled arms, P1 to P5 (P5 is the trust-floor arm, formerly P7), and seven unscheduled, U1 to U7. U6 is the former P5 (paired fault injection) and U7 the former P6 (erasure residue). Every dollar bound was rescaled from list-price high estimates. Cards X14, L5 and the absorb plan were corrected. The pre-registration's diff against the base is still additions only.

**Consequence.** The superseding entries of this pass record each choice.
