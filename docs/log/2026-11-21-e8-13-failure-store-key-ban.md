---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/export/otel.test.ts
  - "make test-one T=packages/core/test/unit/export/otel.test.ts"
supersedes: none
---

**What.** The first run of the implemented mapping failed the real-Plane acceptance case: the test banned every item's `store_ref.key` from attributes, and the fake store's key is the item id, which the span carries on purpose as `gen_ai.memory.record.id`.

**Why.** The ban was written against the files adapter's keys (paths), not the fake's.

**Result.** The ban now skips a store key equal to the item id; a path key (the hand-built events' `memory/<secret>.md`) is still banned. The test was written in this card, before the implementation, and no card's shipped acceptance test was touched.

**Consequence.** None for the mapping.
