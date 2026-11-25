---
date: 2026-11-25
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/E2.15.md
  - docs/tasks/E2.14.md
supersedes: none
---

**What.** Card E2.21 (ADR 0034's grant rules) joins the plan as in flight: its policy option `grants.expiry_cap` goes into E2.14, its part 2 follows H1's `MERGE=4`, and E2.15 runs after it.

**Why.** Review finding AP2-2 and the coordinator's decision: both cards add grant rules beside `grantDefect` in the same write path.

**Result.** The plan's section 1, the wave table, E2.14, E2.15 and the roadmap say so; the card file stays on branch `e2-14-grant-cap`. Whether the cap becomes the default after H1 is lead question 5, since GateMem's `OPEN_END` grants (1,633 of 2,490 fixture writes) would need an exemption or a clamp.

**Consequence.** E2.15 may slip by E2.21's part 2.
