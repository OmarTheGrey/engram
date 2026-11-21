---
date: 2026-11-21
author: claude-agent
type: finding
card: RV8
chapter: design
pillar: research
hypothesis: H2
evidence:
  - research/configs/label-audit-longmemeval.json
  - docs/research/label-audit.md
supersedes: none
---

**What.** LongMemEval's audit should draw stratified, with at least 5 abstention questions of the 50, and the rule should be written into the pre-registration before the audit.

**Why.** The answerability label is the one thing a member checks that the other questions do not, and a uniform draw gives it too few items to find a labelling fault.

**Result.** If a fifth of the abstention labels were wrong, at least one fault appears in 5 items with probability 0.67 and in 2 items with 0.36. The rest could be allocated by question type in proportion. The draw is unchanged, since the rule is the lead's, and its counts are in the key, not in this repository.

**Consequence.** Backlog row for the lead: choose the allocation (one function in `label_audit_sample.py` and its seed), then register it.
