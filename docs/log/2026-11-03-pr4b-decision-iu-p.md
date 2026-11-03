---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/log/2026-11-02-pr2-r3-decision-iut-p.md
  - research/analysis/equivalence.py
supersedes: none
---

**What.** Recommended, for the lead's decision: H4's one p-value for Holm is the intersection-union p, the largest pairwise TOST p, and v1's Multiplicity line names it beside the bootstrap share of H1, H2, H3 and H5 (decision sheet item 13g).

**Why.** v0.2 calls every primary p-value a bootstrap share, which H4's is not; H4 holds only if every pair is equivalent.

**Result.** `intersection_union_p` implements it (`docs/log/2026-11-02-pr2-r3-decision-iut-p.md`).

**Consequence.** If changed to Bonferroni over the pairs, H4 keeps its validity and loses power.
