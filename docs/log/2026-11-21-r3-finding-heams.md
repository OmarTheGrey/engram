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
  - https://arxiv.org/abs/2611.20144
  - https://github.com/milatechtransfer/heams
supersedes: none
---

**What.** HEAMS (Goel et al., arXiv 2611.20144) evaluates six memory systems behind one interface on five dimensions, and ships a governance layer that wraps any memory system in retention and recall policies.

**Why.** It is the nearest published neighbour to Engram's plane over existing stores (card R3).

**Result.** Policies are deterministic rules, free text read by an LLM, or hybrid (Sec. 4.2); every experiment uses free text read by gpt-4o-mini (Appendix D.2), and governance is evaluated only on MilaMem (Table 3, caption). Recall governance cuts scenario leakage from 57.61 to 31.82 percent for 4.80 points of helpfulness (Table 5); retention and recall together raise MPBench resistance from 40.00 to 88.61 percent (Table 8). One user only (Sec. 2.2). The wrapper logs each decision with a reason and a policy id (`wrapper.py`, repository at dec2874).

**Consequence.** Cited as the nearest rival toolkit in related work; nothing is taken.
