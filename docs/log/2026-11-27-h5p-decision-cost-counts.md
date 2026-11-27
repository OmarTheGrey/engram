---
date: 2026-11-27
author: claude-agent
type: decision
card: H5P
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/H5P.md
supersedes: none
---

**What.** The cost bounds count 208 training sessions, 2 to 104 induction calls, 240 to 600 replay sessions (8 to 20 candidates per domain, 15 sessions each) and 540 evaluation sessions.

**Why.** The cost table's H5 rows count a design from before item 63 (5 replay episodes per candidate, every base task, 492 sessions per condition); the low candidate count follows AWM's 7.4 workflows a run (`docs/readings/litreview/2409.07429-awm.md`, Table 10), the high the cap.

**Result.** 84.58 to 1,029.69 billed dollars at list prices; 56.93 to 721.40 ledger dollars, a ceiling of 901.75 (see `docs/log/2026-11-27-h5p-finding-cost-arithmetic.md`). Proposed, card H5P item 15.

**Consequence.** The lead approves, changes or refuses it; nothing is registered until then.
