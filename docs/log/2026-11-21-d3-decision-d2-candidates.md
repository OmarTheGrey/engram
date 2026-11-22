---
date: 2026-11-21
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - research/configs/d3-validate-fixture.json
  - fixtures/distill/d3-validate/tasks.json
  - fixtures/distill/d3-validate/script.json
supersedes: none
---

**What.** The fixture replays card D2's real candidates (its induction config run in process, from its cassette), maps each candidate's `distill:<method>:<sessions>` ref to D1 task ids, and replays on a hand-written pool of six D1 tasks, one an induction task the split drops.

**Why.** The coordinator asked D3 to switch from hand-written candidates to D2's final shape once D2 was in review.

**Result.** Four candidates, ten induction tasks each; five held-out tasks each; the first fixture (retail orders, two hand-written candidates, 41 cassettes) was replaced, its cassettes re-recorded as 98.

**Consequence.** D3 merges after D2. If D2's candidates change in review, the script's keys (skill names) must follow and the cassettes be re-recorded.
