---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/cost-shapes.ts
  - packages/runner/scripts/cost-shapes.ts
  - packages/runner/test/research/cost-shapes.test.ts
  - research/scripts/h1_cost.py
  - research/configs/h1-cost.json
supersedes: docs/log/2026-11-03-pr4a-cost-table.md
---

**What.** The cost table after the review: the entry point records each candidate's cache-read price, thinking format, off effort and whether thinking off reaches it, each read's item text, and per GateMem checkpoint its turns, judge prompt and the text each condition's list shows; `h1_cost.py` uses them.

**Why.** Review findings P4A-2, P4A-5, P4A-6 and P4A-8.

**Result.** Before: reasoning priced only in the high estimate and for every reasoning model alike; items and the judge prompt at the fixture's size. After: reasoning by whether off is honoured, a floor in the low estimate, a per-1,000-tokens column, items and the judge prompt moved to the full set, a price-anomaly flag, and candidate and why-not fields. Tests hold the off-effort reading to pi-ai's code for nine named models; mutants reading a null off as honoured, dropping the floor, or ignoring the item move fail them.

**Consequence.** Part B cites `research/results/h1-cost.json` for the model choice.
