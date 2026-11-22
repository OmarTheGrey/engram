---
date: 2026-11-22
author: claude-agent
type: decision
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/supersede-one-close.test.ts
  - packages/server/test/supersede.test.ts
  - packages/cli/test/supersede.test.ts
supersedes: none
---

**What.** The case L6-9 asked for (one call accepting a writable ancestor and an imported one) is tested below the plan, because no plan can propose both.

**Why.** Two candidates that would both be closed both overlap the new item just before it starts, so they overlap each other, and the clash rule sends the earlier one to review. Accepting a review is a 400 before any write.

**Result.** A property shows a plan proposes at most one close (5000 runs; it fails once the clash rule is disabled). The route's loop is now `writeClosures` and is tested with three closes on the files adapter: the first lands, the second is stopped with its store-failure deny, and the third is never sent. The CLI rendering is now `supersedeLines`, tested on that answer.

**Consequence.** If the clash rule is ever relaxed, the route's multi-close path is already tested.
