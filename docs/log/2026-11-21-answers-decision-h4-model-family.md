---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H4
evidence:
  - docs/decisions/0035-store-independence-is-a-design-property.md
  - research/results/h2-cost-table.json
  - research/results/h4-power.json
supersedes: none
---

**What.** H4 is written as the equivalence of C5's violation rate across M1 to M3 on GateMem at preset medium on Mem0, its size kept at 761 items per arm.

**Why.** ADR 0035 says H4 tests "policy equivalence, the governance outcome across the presets it registers", but H4 registers no preset sweep; the cost table's decided reading keeps H4's model arms, its C2 arm and its Mem0 arm, all at medium.

**Result.** One family of three pairs. Joint power over the four registered families is at most any one family's power, so 761 items keep at least the 80 percent the size was chosen for; no result was recomputed.

**Consequence.** If the lead meant a preset family, H4's test changes before H1's data exist (item 9), and its size needs the power simulation for that family.
