---
date: 2026-11-20
author: claude-agent
type: decision
card: RV8
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/configs/cost-table.json
  - research/results/h2-cost-table.json
supersedes: none
---

**What.** H2's GateMem C2 and C5 at medium, and H3's LongMemEval C5 at medium, are counted as sharing H1's and H2's cells and make no new call.

**Why.** Rule 7 keys a call on item, condition, preset, store, model, seed and prompt hash; the registered designs name the same cells, so a re-run is a cache hit.

**Result.** Those rows carry `shared_with` and enter no total. H4's mem0 arms on M1 are counted as new, since card X9's draw of 761 items is not fixed.

**Consequence.** If H2's configs change a prompt or a store, the shared rows become new; their costs are in the table already.
