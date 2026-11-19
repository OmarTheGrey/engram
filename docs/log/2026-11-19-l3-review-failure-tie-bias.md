---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
  - packages/core/test/unit/lint/model.test.ts
supersedes: none
---

**What.** Review finding L3-5: ties between equally near items went to the lowest ids, so with nine such items, items 6 to 9 were never paired with each other.

**Why.** The tie-break was by id, which favours the oldest items whenever more than five neighbours tie.

**Result.** Two tests (nine tied items: the newest paired too, 36 pairs; thirteen: every item in exactly 10 pairs) failed, then passed with ties broken by distance forward in id order, wrapping round. The fixture replay and the pilot count (51 calls) are unchanged; no cassette recorded again.

**Consequence.** The contradiction candidates decision is superseded by an entry of this date.
