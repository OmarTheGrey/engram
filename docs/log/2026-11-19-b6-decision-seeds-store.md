---
date: 2026-11-19
author: claude-agent
type: decision
card: B6
chapter: design
pillar: research
hypothesis: H2
evidence:
  - research/configs/h2-longmemeval-c2.json
  - docs/research/preregistration.md
supersedes: none
---

**What.** The two baselines run seeds 1 to 3 on store Mem0 with the shared read limit of 20.

**Why.** H2's stopping rule says a fixed sample per preset and names no seeds or store; H3 runs LongMemEval at three seeds, and H1 runs on Mem0 (decision sheet item 2) with the same read limit.

**Result.** Both configs name `seeds: [1, 2, 3]`, `store: mem0`, `read_limit: 20`, so a C2 or C5 session of H2 and of H3 on M1 share their cache keys and are paid once.

**Consequence.** If the lead wants another store or seed count for H2, it is one line in each config; COUNT and the cost table follow it.
