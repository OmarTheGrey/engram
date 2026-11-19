---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-19-rv2-decision-reader-template.md
  - research/configs/h1-table.json
supersedes: none
---

**What.** Review finding RV2-1 (blocking): the first pass told each reader to write their own name into `reader`. Card X4 plans to commit the readings files with the tables, so two members' names would have entered the repository.

**Why.** I chose a template with a name to fill and did not weigh where the files end up. Before this card the readers were the pseudonymous ids `reader1` and `reader2`. Committed outputs carry no member's identity (rule 12 in spirit).

**Result.** Caught in review of PR #53 before anything was committed or run.

**Consequence.** There is now one template per reader with its pseudonymous id filled in, and the join accepts only those two ids (`docs/log/2026-11-19-rv2-review-decision-pseudonymous-readers.md`).
