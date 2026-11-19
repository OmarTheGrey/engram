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

**What.** An item a tier flags that is no label's `finding_on` is unverified, split into base items and unlabelled injected ones, and precision with them is given as a bound: TP over all flagged (every unverified finding false) to TP plus unverified over all flagged (every one real).

**Why.** The task asks for precision both on the labelled items and with base-item findings counted as unverified, with the bound and the count.

**Result.** On the floor, 967 unverified (all base), bound 0.721 to 1.0.

**Consequence.** A judged audit sample narrows the bound; it is not read yet.
