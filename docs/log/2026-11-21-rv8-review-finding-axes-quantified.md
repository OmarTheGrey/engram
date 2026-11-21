---
date: 2026-11-21
author: claude-agent
type: finding
card: RV8
chapter: results
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-frontier-axes.json
  - docs/log/2026-11-20-rv8-finding-flat-axes.md
supersedes: docs/log/2026-11-20-rv8-finding-flat-axes.md
---

**What.** Several single axes move both benchmarks at non-degenerate values: ttl at 1 and 7 days and the retention budget at 25 and 50 each change GateMem checkpoints and LongMemEval questions.

**Why.** Lead-decisions item 21 chooses axes the benchmarks exercise; the earlier finding said no single axis did both.

**Result.** GateMem (2,218 checkpoints), changed and leak targets removed: ttl-1d 306 and 32, ttl-7d 36 and 2, budget-25 560 and 13, budget-50 118 and 0. LongMemEval (500 questions) changed: ttl-1d 401, ttl-7d 401, budget-25 and budget-50 500 each. Grant honouring moves GateMem only (1,154, 292 leak targets removed). No-person reads are degenerate (2,117 and 500). No-model-source moves both by denying 5,795 and 124,334 writes.

**Consequence.** One axis can serve both benchmarks: ttl at 7 days (small on GateMem, large on LongMemEval) or budget 50; the lead chooses.
