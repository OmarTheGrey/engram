---
date: 2026-11-22
author: claude-agent
type: change
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/kit/src/index.ts
  - packages/kit/test/kit.test.ts
supersedes: docs/log/2026-11-21-e8-14-change-framework-kit.md
---

**What.** The framework kit as it now stands: its recall renders the memory tag of `@engram/tag`, not of the pi extension.

**Why.** The earlier entry said the kit rendered the pi extension's tag, which review finding E8.14-4 changed.

**Result.** Everything else in the earlier entry holds: the frozen actor with source `model`, the namespace mapper, `EngramRejected` and `EngramCallError`, one client request per call; 9 tests pass.

**Consequence.** Nothing further.
