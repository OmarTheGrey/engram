---
date: 2026-11-22
author: claude-agent
type: milestone
card: D3
chapter: evaluation
pillar: distill
hypothesis: H5
evidence:
  - research/configs/d3-validate-fixture.json
  - fixtures/cassettes/d3-validate-fixture
  - "make run CONFIG=research/configs/d3-validate-fixture.json"
supersedes: docs/log/2026-11-21-d3-milestone-acceptance.md
---

**What.** Card D3's acceptance passes under the lead's rule: two offline runs of `make run CONFIG=research/configs/d3-validate-fixture.json` each print "model calls: 0 new, 334 from cassettes (D2's induction: 0 new, 1 from its cassette)".

**Why.** The card's acceptance, rerun after the rule changed and the cassettes were re-recorded.

**Result.** Under preset medium: edit-a-file-and-check-the-edit passes 4 of 5 held-out tasks (2 of 5 without it), active. run-a-command-then-read-what-it-points-at passes 3, inspect-a-source-file-before-changing-it 2, and the two rule candidates 1 and 0. Each of those is denied `engram/promote/no-evidence` and stays a candidate.

**Consequence.** The numbers are a scripted fixture's and assert the pipeline, not a result.
