---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - docs/research/prereg-v1-decisions.md
supersedes: none
---

**What.** The decision sheet `docs/research/prereg-v1-decisions.md` lists the 20 decisions v1 needs from the lead, item 13 in eight parts.

**Why.** Plan decision 1: v1 is drafted with recommendations, and the lead accepts or changes each before the tag.

**Result.** Each item gives the question in one sentence, the recommendation, the evidence (a result with its MANIFEST sha256 prefix, a log entry or an ADR), the alternatives with what each costs, what changes in v1 if the lead chooses otherwise, and a line for the lead's answer. Items 1 to 17 are the brief's; 18 to 20 were added (`2026-11-03-pr4b-decision-extra-items`). Every number in it is cited to a result file or an entry.

**Consequence.** Each recommendation has its own decision entry (`2026-11-03-pr4b-decision-*`), which the lead's answer supersedes.
