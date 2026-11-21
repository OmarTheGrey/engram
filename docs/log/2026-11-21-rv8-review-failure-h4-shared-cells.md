---
date: 2026-11-21
author: claude-agent
type: failure
card: RV8
chapter: results
pillar: research
hypothesis: H4
evidence:
  - research/results/h2-cost-table.json
  - research/configs/cost-table.json
supersedes: none
---

**What.** The cost table counted H4's Mem0 arms on M1 at C5 and C2 as new calls (review finding RV8-4).

**Why.** Their row text said whether they reuse H1's cells depended on card X9's draw.

**Result.** H1 runs every GateMem checkpoint at C2 and C5 on Mem0 and M1, preset medium, three seeds, and H4's 761 per arm is a subset of those items whatever the draw, so the cells (item, condition, preset, store, model, seed) are the same and their cassettes serve both (rule 7). The arms and their judge rows were double counted: 323 dollars of H4's registered high of 5,552.

**Consequence.** They are marked shared; see the decision entry of this pass.
