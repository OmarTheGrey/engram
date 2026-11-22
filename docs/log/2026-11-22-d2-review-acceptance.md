---
date: 2026-11-22
author: claude-agent
type: milestone
card: D2
chapter: evaluation
pillar: distill
hypothesis: H5
evidence:
  - fixtures/cassettes/d2-induce-fixture
  - research/configs/d2-induce-fixture.json
  - "make run CONFIG=research/configs/d2-induce-fixture.json"
supersedes: docs/log/2026-11-21-d2-acceptance.md
---

**What.** Card D2's acceptance passes after the fix pass. Two runs each print "model calls: 0 new, 1 from cassettes".

**Why.** The rule control changed (finding D2-2), and the review asked for the acceptance to be rerun.

**Result.** AWM's output is unchanged: 3 candidates and 2 rejections. The control now gives 10 candidates, one per kept trajectory, each with its one session as lineage. All 13 writes are allowed by `preset.medium/write/person`. The cassette, deleted and re-recorded, has no diff.

**Consequence.** Card D3 re-records against the new rule candidates.
