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
supersedes: none
---

**What.** In the revocation grid, indirect insertion writes both records, revocation mark included, through the adapter directly (never `Plane.write`), then adopts the scope with `adoptStoreItems` as the owner, as `engram read` does, then reads through the plane.

**Why.** The adapter writes each store's own format (a Markdown file, a MemFS commit, a Mem0 memory), so one path serves all six stores; RV4's tests write files by hand only because they are about the files adapter. This is 2609.08258's "direct insertion" (native records with an explicit mark); its "indirect insertion" (prose only) is the grid's "prose only" row.

**Result.** All 12 indirect cells on the six stores pass with zero adoption denials.

**Consequence.** If wrong, a store's raw format written by a foreign tool (a Mem0 memory without Engram metadata) is untested here; such a record carries no mark and falls under the prose row.
