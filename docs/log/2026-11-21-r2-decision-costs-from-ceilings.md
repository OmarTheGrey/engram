---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - research/configs/cost-table.json
  - research/results/h2-cost-table.json
supersedes: none
---

**What.** Each proposal gives its cost as counted sessions and calls. Its dollar figure is a bound scaled from a registered spend ceiling in the Models section, never a new price.

**Why.** Rule 9: a number typed by hand does not exist. The registered ceilings come from the cost table, so scaling one by a session count is arithmetic on a registered number. A new price would need the cost table to be run again.

**Result.** Examples: P2's two profiles come to 228 of H1's 456 MEM-INV-Bench sessions, about 2.33 dollars at its 4.65-dollar ceiling. U1's arm T is 2,184 GateMem sessions, about 8 percent of H1's 26,616, or about 128 dollars.

**Consequence.** Before registration, each arm is counted by its config's `COUNT=1` and priced by the cost table. The bounds here do not survive a change of prices.
