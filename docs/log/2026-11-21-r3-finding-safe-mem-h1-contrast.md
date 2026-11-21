---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - docs/research/positioning.md
  - https://arxiv.org/abs/2610.22959
supersedes: none
---

**What.** SAFE-Mem's Appendix M is the nearest published instance of H1's contrast between C4 (the model decides from per-item metadata) and C5 (the plane withholds).

**Why.** It shows the entries that fail admission either withheld or retrieved with a marker that limits them to description, so the model decides.

**Result.** Labelling instead of withholding raises MPBench attack success from 2.6 to 6.2 percent on GPT-5.6-terra and from 6.2 to 19.6 percent on GPT-4o-mini (Table 13), and gains about three LoCoMo points. The direction matches H1's: enforcement leaks less than a model told which entries are restricted. It is one benchmark, two models, no registered test.

**Consequence.** Cited as prior evidence in H1's discussion; it makes H1's question less new and changes nothing registered.
