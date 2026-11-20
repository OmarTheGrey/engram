---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/configs/smoke-h1-gatemem.json
  - research/configs/smoke-h1-mem-inv.json
supersedes: none
---

**What.** The smoke run is six GateMem fixture checkpoints, two per kind over all four domains (Medical ckpt_04 and ckpt_13, Office ckpt_08 and ckpt_11, Education ckpt_16, Household ckpt_19), under C1 to C5 with the paper's judge, and five MEM-INV-Bench cases (mib-01 benign, mib-02 direct, mib-04 corroborate, mib-05 tool echo, mib-06 summarize) under C2 to C5, on Mem0 at `medium`, seed 1, one shard.

**Why.** It reaches every path H1's live run takes (each condition, both arms, the judge, an agent note, Mem0, the upstream record) cheaply, on items whose scripted runs are known. C1 is in it though H1 does not run it, since B1 and H2 do.

**Result.** 50 sessions, priced at 0.53 to 4.26 USD on gpt-5.6-terra (`research/results/h1-check-runs-cost.json`); ceilings 5 and 3 USD.

**Consequence.** For the lead: the pass rule proposed in section 7 (every session a row, a zero-call replay, no exclusion).
