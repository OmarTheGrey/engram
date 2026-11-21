---
date: 2026-11-21
author: claude-agent
type: finding
card: A5
chapter: discussion
pillar: plane
hypothesis: H3
evidence:
  - packages/adapters/test/plane/revocation.test.ts
  - docs/decisions/0005-bi-temporal-validity.md
  - "make test-one T=packages/adapters/test/plane/revocation.test.ts"
supersedes: docs/log/2026-11-21-a5-finding-lineage-not-read-as-revocation.md
---

**What.** A replacement that names the old version in its `lineage` and closes nothing leaves both versions admitted, and a read through the store's search ranks the two, which match a title query alike, in the store's own hit order.

**Why.** ADR 0005 decision (a) reads "the latest valid version at query time", but its chosen form pairs lineage with closing the old version's `valid_to`, the grid's `closed` mark, which holds; lineage alone is half of it. `itemByStoreRef` applies lineage only among holders of one ref, and these versions have distinct refs (ADR 0013, D1).

**Result.** Pinned in both write orders on six stores: the plane's order follows the store's hits (fake write order, files and Letta id order, Mem0 embeddings), and swapping order and ids swaps it on the lexical stores.

**Consequence.** For the lead: should reads drop an active ancestor under a different ref?
