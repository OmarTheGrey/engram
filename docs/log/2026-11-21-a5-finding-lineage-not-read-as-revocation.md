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
  - packages/core/src/items.ts
  - "make test-one T=packages/adapters/test/plane/revocation.test.ts"
supersedes: none
---

**What.** A replacement that names the old version in its `lineage`, with the old version left active, does not revoke it: every read through the plane admits both, on every store and under both insertions.

**Why.** The architecture says every update is a new version pointing at the one it supersedes, but lineage decides only which holder a store_ref resolves to (`itemByStoreRef`); the read filter checks status, ttl, reach and validity.

**Result.** With the store's search ranking the hits, the old version ranked above its replacement in 9 of 9 scenario reads on the fake, files and Letta and 8 of 9 on Mem0, reproducing 2609.08258; the core pipeline and the store without search ranked the replacement first. Pinned as a characterisation in the grid's "lineage only" rows.

**Consequence.** A core card should decide whether a read excludes an active ancestor of an admitted version; no change here.
