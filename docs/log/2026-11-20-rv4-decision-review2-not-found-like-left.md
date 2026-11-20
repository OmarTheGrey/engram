---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/events.ts
supersedes: docs/log/2026-11-20-rv4-decision-review-not-found-id-refused.md
---

**What.** For N-3, a not-found erasure is treated as a left-in-store one: its id is refused while it holds the erased content and adopted once it changes. This supersedes the first pass's decision that such an id is refused whatever it holds.

**Why.** The stricter rule refused a person's genuinely new file forever after the folder moved back, and its delete fails on a read-only file. Erased content stays refused under any id by its hash, which is what the erasure must guarantee.

**Result.** The N-3 test compares P32 with P33: the same outcome, one adoption and three refusals.

**Consequence.** A store write in flight under an erased id with new content would be adopted; for the files adapter no such writer exists after the report.
