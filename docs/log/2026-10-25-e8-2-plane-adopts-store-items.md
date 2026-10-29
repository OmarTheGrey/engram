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
  - packages/core/src/plane/write.ts
  - packages/core/test/unit/plane/adopt.test.ts
  - packages/adapters/test/plane/adopt-files.test.ts
  - "pnpm exec vitest run packages/core/test/unit/plane/adopt.test.ts packages/adapters/test/plane/adopt-files.test.ts"
supersedes: none
---

**What.** Core gained `adoptStoreItems(deps, actor, scope, at)`: it lists the adapter's items in one scope, skips those the projection holds unchanged (status ignored), and runs every other item through the write gate, recording an allowed item at its existing store_ref instead of writing it.

**Why.** The read path reads the projection, so memories Claude Code wrote into a folder were invisible to `engram read`; adopting them in a surface would have meant a surface calling an adapter (AGENTS.md rule 2).

**Result.** The orchestrator's five adoption tests pass, and so does a files adapter test: four fixture memories adopted, readable, folder bytes unchanged. Removing the existing-ref path makes one adoption test fail.

**Consequence.** A denied item is gated again, with a new deny event, on every adoption run.
