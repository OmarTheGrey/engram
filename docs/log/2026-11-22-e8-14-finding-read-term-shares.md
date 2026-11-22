---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.14
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** A text read's `filtered` count may reveal whether an item reached only through a grant that does not admit it contains the query's words; recorded for the lead, not changed.

**Why.** Found by the review of card E8.14. `Plane.read` matches term shares over `reach`, and `reachable` counts any grant whose `to` matches the reader, whatever its class or expiry; an item so reached that holds a query term is a candidate, which the filter removes and `filtered` counts.

**Result.** A reader holding an expired or wrong-class grant to an item can ask word by word and see `filtered` move. Decision D5 allows such items to count in `filtered`; the by-id read now drops them (ADR 0047). `Plane.read` is registered behaviour, so it is left as it is.

**Consequence.** For the lead: whether a text read should drop such candidates too, after the tag.
