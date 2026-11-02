---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-c4-verdict-agreement.json
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: docs/log/2026-11-02-x1r-c4-verdict-agreement.md
---

**What.** GateMem's RAG-Policy verdict and the plane's read decision disagree on more than a quarter of the turn items H1's GateMem arm shows, and the plane's verdict does not move with the preset.

**Why.** The earlier finding cited a development command; the shares now come from a rule-9 result.

**Result.** 27.7 percent of 325,530 turn items disagree, 18.5 percent the gate allowing what the plane denies; on leak-target turns of access-control checkpoints the gate allows 1,528 of 5,259 and the plane 722 (`research/results/h1-c4-verdict-agreement.json`). Strict, medium and permissive give identical counts: every GateMem asker reads as a person-level actor, whose row of the read matrix is the same in the three presets (`packages/core/policies/*.yaml`), and all three honour grants, as PR 2's reach result also found.

**Consequence.** For part B's decision sheet: with `gatemem-rag`, C4 minus C5 would mix policy into mechanism; the preset does not change C4's verdicts.
