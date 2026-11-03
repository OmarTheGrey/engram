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

**Why.** Review P4A-8. An item's tag does not grow with its text, so the move is additive; the lists are the walk's own (`walkLists`, shared with `walkRow`; the walk result is unchanged, `479f2419...`).

**Result.** The script checks the lists' item totals against `research/results/h1-c4-walk.json` and refuses to price on a mismatch. MEM-INV-Bench's items stay the fixture's: its arm is under 2 percent of any total.

**Consequence.** A whole-episode measure, as the review took, would raise the cost where this lowers it.
