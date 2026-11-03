---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-cost.json
supersedes: none
---

**What.** GateMem's C4 and the high estimate's two assumptions drive H1's cost; MEM-INV-Bench is under 1 percent of it.

**Why.** The lead weighs a model's price against how much of the range is assumption.

**Result.** A low GateMem C4 session carries 9,440 to 11,933 input tokens against 3,750 to 3,797 for C2 (`measured.gatemem.C4`), from the walk's 52 to 79 items per read. Two more read turns and three characters per token take GateMem's input from 162M to 810M tokens. For gpt-6.1-sol, the 1,024 reasoning tokens per answer call add 109M output tokens, about 1,090 of its 2,734 dollars (high), against 337 dollars low. On access and forgetting checkpoints alone (dropping utility) GateMem costs about 69 percent of the full arm.

**Consequence.** The first live sessions' usage ledger (`usage.json`) measures turns and reasoning tokens; the range should be narrowed from it before the full run.
