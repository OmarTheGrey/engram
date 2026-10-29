---
date: 2026-10-29
author: claude-orchestrator
type: change
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/core/test/unit/plane/adopt.test.ts
  - "pnpm exec vitest run packages/core/test/unit/plane/adopt.test.ts"
supersedes: none
---

**What.** When adoption finds that the ref a store lists an item under is already held by an unrelated item, the store-failure reason now says the store breaks the adapter contract and that nothing was written. It no longer says the store wrote orphaned bytes.

**Why.** Restacking put PR #5's round-2 reason for a colliding ref (finding N4, written for a store write) on PR #6's adoption path, which records a ref the store already holds and never writes. The reason claimed a write that did not happen.

**Result.** The adoption collision test now also asserts the reason says "nothing was written" and names no orphaned bytes; it failed before the change and passes after. A collision after a real write keeps the N4 wording, which its write test still checks.

**Consequence.** Every store-failure reason describes what the plane actually did.
