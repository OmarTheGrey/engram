---
date: 2026-11-21
author: claude-agent
type: change
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/research/absorb/07-evalops.md
  - https://huggingface.co/datasets/xiaowu0162/longmemeval-v2
supersedes: none
---

**What.** I added a benchmark intake note to the proposals section. It covers eleven memory benchmarks, LongMemEval-V2 first, and the data the scheduled arms would take. Each licence was read at its source on 2026-11-21 and recorded with the revision read.

**Why.** Card R2, step 4: decide what may be added before any run, listing only licences checked at the source. HaluMem is not proposed again.

**Result.** Five are admissible: LongMemEval-V2 (Apache-2.0, 451 questions), Memora, DolphinBench, STALE and EvalMem's builder. MemDerive's data is admissible but cannot be pinned without a commit. AgentMemBench and AfterDeleteBench have no release. StreamMemBench and PersonaMem stay out until an inherited non-commercial term is resolved. Costs are sessions per condition over three seeds.

**Consequence.** Under lead-decisions item 9, a benchmark taken in after 1 December enters only a descriptive arm, never a registered primary set. Each pin is its own pull request (rule 8).
