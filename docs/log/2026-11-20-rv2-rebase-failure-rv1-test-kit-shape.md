---
date: 2026-11-20
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/rv1-review.test.ts
  - "make lint after the rebase: rv1-review.test.ts(325,74): error TS2551: Property 'template' does not exist"
supersedes: none
---

**What.** After the rebase, `make lint` failed in RV1's test "a capped UNREAD session never goes to the readers". It called `unreadKit` with a readers argument and read `.template`, the kit's shape before RV2.

**Why.** The two cards were written in parallel. RV1's test predates RV2's per-reader templates, and the rebase merged without a textual conflict.

**Result.** I changed only the test's call shape and kept its intent. A capped UNREAD session now appears in neither reader's template nor the key, and an uncapped one appears in both and the key. The test passes, and `make lint` passes.

**Consequence.** Nothing else in RV1's code used the old shape.
