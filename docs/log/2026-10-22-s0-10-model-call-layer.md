---
date: 2026-10-22
author: omar
type: change
card: S0.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/model.ts
  - packages/runner/src/model/cached.ts
  - packages/runner/test/model/cached.test.ts
  - scripts/test/pi-import-rule.test.ts
  - "pnpm --filter runner test"
supersedes: none
---

**What.** Step-0 task S0.10 added the model call layer: `ModelCall` and `requestHash` in core; a scripted `ModelCall` keyed on the request hash that fails loudly on a miss; `cached()` with the ADR 0017 key, usage capture and an `ENGRAM_OFFLINE=1` refusal; a pi-ai backed `ModelCall` in the runner; and a Biome rule rejecting pi imports in core and adapters.

**Why.** AGENTS.md rules 4, 6 and 7: the plane never calls a model, and every call is seeded and cached.

**Result.** 13 runner tests: a second identical call makes zero underlying calls, offline mode throws on a miss and answers a hit, usage is recorded for hits and misses, and file cassettes survive a new process. Three tests show the import rule fires in core and adapters, not in the runner.

**Consequence.** `ModelCall` is a type in core, so lints and the distiller receive it without importing the runner.
