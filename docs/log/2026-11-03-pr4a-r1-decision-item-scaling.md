---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/cost-shapes.ts
  - packages/runner/src/research/c4-evidence.ts
  - research/scripts/h1_cost.py
supersedes: none
---

**What.** GateMem's tokens per shown item are the fixture reads', moved additively by the difference in text characters per item between the full set's lists (per condition and item kind, each checkpoint's own question) and the fixture reads, over four; the judge's input moves by the difference in its checkpoint-dependent prompt.

**Why.** Review P4A-8 asked the item size and judge prompt scaled to the full set; an item's tag and attributes do not grow with its text, so the move is additive, and the lists are the ones the walk counts (`walkLists`, shared with `walkRow`, whose result is unchanged at `479f2419...`).

**Result.** The cost script checks the lists' item totals against `research/results/h1-c4-walk.json` and refuses to price on a mismatch. MEM-INV-Bench's items stay the fixture's: its memory is a few short entries and its arm is under 2 percent of any total.

**Consequence.** If the review's whole-episode measure was meant, it would raise the cost where this lowers it; the result records both sizes.
