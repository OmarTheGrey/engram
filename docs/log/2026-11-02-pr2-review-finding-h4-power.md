---
date: 2026-11-02
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/analysis/bootstrap.py
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-02-pr2-finding-h4-power.md
---

**What.** With a TOST that holds its level, about 100 items per arm powers H4 in no grid cell at 2 or 5 points and in 4 of 16 cells at 10 points for one family (1 of 16 for four families).

**Why.** H4 needs every pair to pass across stores and across models, on GateMem and MemoryAgentBench: four families, each 0.8^(1/4) for joint 0.8 if they pass independently. Under the generative model a store table and a model table coincide.

**Result.** Sizes scale with kappa times 2p(1 - p) over the margin squared, divided by three for independent seeds; the exact route makes strongly paired, low-rate cells need more items than the closed form (2 points, rate 0.02, kappa 0.25, independent seeds: 905 against 110).

**Consequence.** For PR 4's sheet, undecided: 10 points with a few hundred items per arm, or 5 points with up to 2,560.
