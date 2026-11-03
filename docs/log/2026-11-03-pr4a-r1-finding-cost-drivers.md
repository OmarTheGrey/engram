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
supersedes: docs/log/2026-11-03-pr4a-finding-cost-drivers.md
---

**What.** GateMem's C4, the extra read turns, and reasoning that thinking off cannot stop drive H1's cost; MEM-INV-Bench stays under 2 percent of it.

**Why.** The superseded entry priced no reasoning for models that ignore thinking off, and items at the fixture's size.

**Result.** A low C4 session carries 8,808 to 11,037 input tokens against 3,623 to 3,677 for C2 (`measured.gatemem`). Two more read turns and three characters per token take GateMem's input from 152.9M to 738.4M. For gpt-6.1-sol, which ignores thinking off, 4,096 reasoning tokens per call (high) add about 4,436 of its 6,206 dollars, and the 256-token floor about 139 of its 526 (low); 1,000 reasoning tokens per call cost it 541.52 low and 1,082.96 high. Access and forgetting checkpoints alone cost about 68 percent of the GateMem arm.

**Consequence.** The first live sessions' usage ledger measures turns and reasoning; the range should be narrowed from it before the full run.
