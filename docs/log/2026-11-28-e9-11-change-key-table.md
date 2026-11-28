---
date: 2026-11-28
author: claude-agent
type: change
card: E9.11
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/crypto/keys.ts
  - packages/core/src/db/migrate.ts
  - packages/core/test/unit/crypto/keys.test.ts
  - packages/core/test/fakes/key-provider.ts
supersedes: none
---

**What.** Migration 7 adds the side table `data_keys` on SQLite and Postgres, and `packages/core/src/crypto/keys.ts` holds per-person data keys through an injected `KeyProvider`: `ensureDataKey`, `openDataKey`, `dataKeyState`, `shredDataKeys`, `rewrapDataKeys`.

**Why.** Card E9.11 steps 2 and 3: the key table and the provider crypto-shredded erasure needs, with no change to `schema.ts`.

**Result.** `make test-one T=packages/core/test/unit/crypto/keys.test.ts`: "Tests 22 passed (22)", the suite on both backends. Test first: it failed on the missing module before the code existed. Mutation checks: dropping the scope from the wrap's associated data failed three tests; leaving `wrapped` in place on a shred failed four. Core draws no randomness and reads no clock: the provider gives the bytes, the caller the time. The design is a port of Compartment's (`docs/absorbed.md`).

**Consequence.** Nothing calls it yet; E9.13 does, under `erasure.mode: shred`.
