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

**What.** Proposed for the lead: cost bounds that count 208 training sessions, 2 to 52 induction calls, 240 to 600 replay sessions (8 to 20 candidates per domain, 15 sessions each) and 540 evaluation sessions.

**Why.** The cost table's H5 rows count a design from before item 63; the low candidate count follows AWM's 7.4 workflows a run (`docs/readings/litreview/2409.07429-awm.md`, Table 10), the high the cap.

**Result.** 84.58 to 1,027.45 billed dollars at list prices; 56.93 to 720.28 ledger dollars, conditional on gpt-4.1's ratio; no ceiling stated (`docs/log/2026-11-27-h5p-finding-cost-arithmetic.md`). Card H5P row 15.

**Consequence.** The lead's answer entry on this item supersedes this one; nothing is registered until then.
