---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/core/src/plane/read.ts
  - packages/runner/src/conditions.ts
  - packages/runner/test/retrieval.test.ts
supersedes: none
---

**What.** Every condition orders the items a read shows by core's `rankForRead`: relevance as each item's share of the query terms, plus confidence and recency, ties by item id.

**Why.** C2 to C4 listed the store's order and C5 the plane's score, with relevance from the store's rank among admitted hits, so the same items came in different orders (finding P3-11). A per-item score orders a set and every subset alike.

**Result.** The shared entries of C2 and C5 come in the same order on every fixture checkpoint and query; returning the store's order in C2 fails 19 of 21 tests. The RN1, B3, B4 and X1 cassettes were recorded again by `make fixtures`.

**Consequence.** A semantic store's ranking no longer sets relevance; the store still decides which items are hits.
