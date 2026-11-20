---
date: 2026-11-20
author: claude-agent
type: change
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/before-read.ts
  - packages/core/test/unit/plane/before-read.test.ts
  - packages/server/test/rv5.test.ts
  - "pnpm exec vitest run packages/server/test/rv5.test.ts"
supersedes: none
---

**What.** What runs before a read moved into one core function, `syncBeforeRead`, which the HTTP read route (so `engram read` and `engram mcp`) and the pi extension's `before_agent_start` call (finding RV-SRF-1).

**Why.** The read route swept the store's scope as its owner at the request's `at` for every reader, so a reader refused by `POST /retain` could still retire the owner's items by naming a future time.

**Result.** Before the fix, three of the four RV-SRF-1 tests in `packages/server/test/rv5.test.ts` failed: a non-owner's read with `at` 2030 appended a retire event made by `person:dana`. After it, a non-owner's read sweeps nothing, the owner's read sweeps only at the server's clock, and a future `at` retires nothing; all four pass, with three unit tests of the core function.

**Consequence.** No surface holds the "who sweeps when" rule any more (AGENTS.md rule 1). ADR 0025 has a proposed amendment.
