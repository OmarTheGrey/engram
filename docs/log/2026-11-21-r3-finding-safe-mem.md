---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: related-work
pillar: plane
hypothesis: none
evidence:
  - docs/research/positioning.md
  - https://arxiv.org/abs/2610.22959
  - https://github.com/LVenum/SAFE-Mem
supersedes: none
---

**What.** SAFE-Mem (Li et al., arXiv 2610.22959) is a memory system of its own, a claim graph, in which each claim carries a kind, an authority and a scope and is admitted only for the uses those labels support.

**Why.** It is the nearest published neighbour to Engram's typed admission (card R3).

**Result.** Admission is a comparison in code (Eq. 2; `_admits` in `src/ams/memory/typed.py`, repository at bac6090), over labels of which a model sets the kind at extraction and the use a request needs (prompts Q.1 and Q.4), and channel records set authority and scope (Sec. 4.1). On MPBench, attack success falls from 26.7 to 2.6 percent on GPT-5.6-terra while recall rises from 75.9 to 86.3 percent (Table 1). It is not a layer over other stores: every baseline shares one memory (Sec. 5.1).

**Consequence.** Cited as the nearest neighbour for admission, and as pressure on H2; nothing is taken.
