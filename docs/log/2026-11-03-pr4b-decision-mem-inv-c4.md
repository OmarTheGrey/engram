---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-mem-inv-admission.json
  - docs/log/2026-11-02-x1r-mem-inv-c4-no-verdict.md
supersedes: none
---

**What.** Recommended, for the lead's decision: MEM-INV-Bench's C4 shows each item's channel and provenance kind and no verdict (ADR 0031, decision 6; decision sheet item 7).

**Why.** A verdict faithful to C5 on this arm would be the write gate's decision.

**Result.** Under medium the plane admits 32 of 32 attacks' poison and 6 of 6 benign values (`research/results/h1-mem-inv-admission.json`), so a verdict would read `allowed` on every item.

**Consequence.** If item 11 changes to strict, where a verdict would vary, this item is revisited.
