---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/letta/index.ts
  - "pnpm --filter adapters exec vitest run test/conformance -t letta"
supersedes: none
---

**What.** The first conformance run of the Letta adapter failed all 42 of its cases with `TypeError: realpath.native is not a function`.

**Why.** The adapter compared the folder it was given with git's `--show-toplevel` through `realpath.native`, which exists on the callback `node:fs` API but not on `node:fs/promises`.

**Result.** `fs/promises` `realpath` already resolves through the native call, so the fix was to call it directly; after it the 42 cases passed (`pnpm --filter adapters exec vitest run test/conformance -t letta`).

**Consequence.** None beyond the fix; recorded so the next adapter on `fs/promises` does not repeat it.
