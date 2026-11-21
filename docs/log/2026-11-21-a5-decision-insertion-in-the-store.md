---
date: 2026-11-21
author: claude-agent
type: decision
card: A5
chapter: design
pillar: plane
hypothesis: H3
evidence:
  - packages/adapters/test/plane/revocation.test.ts
supersedes: docs/log/2026-11-21-a5-decision-indirect-insertion.md
---

**What.** The grid's two insertions are named "through the plane" (both versions and the mark through `Plane.write`) and "in the store" (both records, mark included, written through the adapter, never `Plane.write`, then adopted with `adoptStoreItems` as the owner, as `engram read` does, then read through the plane).

**Why.** The first names, "direct" and "indirect", inverted the paper's terms: 2609.08258's "direct insertion" is native records with an explicit mark, which is "in the store" here, and its "indirect insertion" (prose only) is the grid's "prose only" row. The adapter writes each store's own format, so one path serves all six stores.

**Result.** All 12 "in the store" cells pass with zero adoption denials.

**Consequence.** If wrong, a raw record written by a foreign tool, with no Engram metadata, is untested here; it carries no mark and falls under the prose row.
