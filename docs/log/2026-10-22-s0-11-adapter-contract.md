---
date: 2026-10-22
author: omar
type: change
card: S0.11
chapter: implementation
pillar: plane
hypothesis: H4
evidence:
  - packages/adapters/src/contract.ts
  - packages/adapters/src/fake/index.ts
  - packages/adapters/test/conformance/suite.ts
  - "pnpm --filter adapters test"
supersedes: none
---

**What.** Step-0 task S0.11 added the `Adapter` contract (read, write, delete, list, optional search and history, capability flags), a complete in-memory fake, and the conformance suite as an exported `conformance(name, factory)` that adapters A1 to A3 call from their own tests.

**Why.** ADR 0013 and H4: every store is held to one contract, first on a fake, then in CI service containers.

**Result.** 32 cases pass on the fake with and without its optional methods: round trip, idempotent write, store_ref opacity (serialisable, foreign refs refused), delete visibility, scope-exact list, search never crossing the scope filter, recall on a five-item corpus, and history in order. Mutations that ignore the scope filter or skip deletion fail it.

**Consequence.** Refs are keyed by item id in the fake; real adapters may key differently because the plane never builds a ref.
