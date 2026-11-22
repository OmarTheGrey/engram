---
date: 2026-11-21
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
supersedes: none
---

**What.** Card D3's acceptance passes: `make run CONFIG=research/configs/d3-validate-fixture.json` prints "model calls: 0 new, 98 from cassettes (D2's induction: 0 new, 1 from its cassette)".

**Why.** The card's acceptance: the failing candidate stays a candidate and the passing one becomes active, from cassettes with zero new calls.

**Result.** Under preset medium (4 of 5): edit-a-file-and-check-the-edit passes 4 of 5 held-out tasks (2 of 5 without it), promote allow `preset.medium/promotion/procedural`, active. inspect-a-source-file-before-changing-it and run-a-command-then-read-what-it-points-at pass 3 of 5, call-read-then-read 1 of 5; each promote deny `engram/promote/no-evidence`, candidate. `make test-invariants`: 17 passed.

**Consequence.** The numbers are a scripted fixture's and assert the pipeline, not a result.
