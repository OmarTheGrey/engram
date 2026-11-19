---
date: 2026-11-19
author: claude-agent
type: decision
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/scripts/lint_scores.py
supersedes: none
---

**What.** Unverified findings are counted per finding (lint and item), in three parts: on base items, on labelled items by a lint the label does not name (`other_lint`), and on other injected items.

**Why.** Once a label is credited only by its own lints, one item can carry an explained finding and an unexplained one; counting items would hide the second.

**Result.** On the floor the count is unchanged: 967, all base, as each base item has one duplicate finding.

**Consequence.** The precision bound's U is a count of findings, its TP and FP counts of labels.
