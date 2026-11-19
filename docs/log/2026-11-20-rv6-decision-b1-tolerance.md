---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/configs/b1-gatemem-reference.json
  - packages/runner/src/research/check-runs.ts
  - docs/readings/litreview/2606.18829-gatemem.md
  - "node packages/runner/scripts/check-runs.ts b1-items --data .engram/upstream/gatemem/bench/data"
supersedes: none
---

**What.** Proposed for the lead: B1 runs C1 (GateMem's long-context agent) on GPT-5.4 over 150 Medical checkpoints, 50 per kind spread evenly over the domain's 210, 192 and 177, judged by GPT-4o; it passes when U, A and F each lie within 1.96 sqrt(p(1-p)/50) plus 3 points of the paper's Medical, GPT-5.4, Long-Context row.

**Why.** That row (U 91.4, A 10.4, F 2.3) is the one the literature note records; one domain keeps it cheap. The band is sampling error at n = 50 plus a margin for model version, judge and sampling.

**Result.** Bands: U 91.4 plus or minus 10.8, A 10.4 plus or minus 11.5, F 2.3 plus or minus 7.2. U, A and F as Eqs. 10 to 12 (a wrong action counts). Priced at 2.06 to 6.04 USD.

**Consequence.** A miss is a port defect to find before the tag.
