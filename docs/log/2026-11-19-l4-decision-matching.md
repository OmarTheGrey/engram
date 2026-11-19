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

**What.** A tier flags a label when any of its findings lands on the label's `finding_on`, whatever lint of the tier found it; per-lint cells count only that lint's own labels.

**Why.** L2's decision `finding_on` says to score by it, since L3 flags the later item of a pair. Class figures ask whether an item is caught; which lint caught it is the per-lint table's question, with the model tier's own-unit outcomes beside it.

**Result.** A finding on another lint's label shows as `elsewhere.other_labels`, not as a hit for that lint.

**Consequence.** If wrong, a strict reading needs one change in `hits`; on the floor the two agree, as L2's check found no unexpected finding.
