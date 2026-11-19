---
date: 2026-11-19
author: claude-agent
type: change
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/model.ts
  - packages/core/test/unit/lint/model.test.ts
  - packages/core/test/unit/plane/lint-model.test.ts
  - packages/core/test/property/lint-leak.test.ts
  - research/tests/test_l3_variance.py
  - "make run CONFIG=research/configs/l3-lint-fixture.json"
supersedes: none
---

**What.** Card L3's review fix pass closes the eight findings of the review of PR #45 at 330b3c4 and backlogs its two further findings.

**Why.** The coordinator's review found four important and four minor defects.

**Result.** Each fix was test first and mutation-checked. The fixture replay still makes 0 new calls with identical rows, and the pilot still counts 51 calls; no cassette or fault fixture was recorded again.

**Consequence.** The decision entries for usage, unsupported-claim units, contradiction candidates, reply parsing and variance metrics are superseded by entries of this date.
