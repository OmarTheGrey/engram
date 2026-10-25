---
date: 2026-10-25
author: claude-agent
type: change
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/test/unit/plane/adopt.test.ts
  - packages/adapters/test/plane/adopt-files.test.ts
  - docs/architecture.md
  - "pnpm exec vitest run packages/core/test/unit/plane/adopt.test.ts packages/adapters/test/plane/adopt-files.test.ts"
supersedes: docs/log/2026-10-25-e8-2-plane-adopts-store-items.md
---

**What.** `adoptStoreItems` now adopts as the store's owner with source import, marks its events, retracts and stops re-gating unchanged denials (decision D8).

**Why.** The superseded entry described adoption under whatever actor the caller passed, which in the CLI was the reader, and recorded that a denied item is gated again on every run. Neither holds now, and the plane served content a store had deleted or changed into a denied version.

**Result.** A projected item the store no longer lists, or whose store version is denied, is retired with one `engram/adopt/retract` event; a denial whose recorded hash is unchanged appends nothing. Sixteen core tests and two files-adapter tests pass; nine mutants of the new rules were killed.

**Consequence.** The architecture's write path describes adoption.
