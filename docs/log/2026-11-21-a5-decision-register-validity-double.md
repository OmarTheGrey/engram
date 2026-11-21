---
date: 2026-11-21
author: claude-agent
type: decision
card: A5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/registry.ts
  - "pnpm exec vitest run packages/adapters/test/plane/acceptance.test.ts packages/adapters/test/plane/replay-workload.test.ts --no-file-parallelism"
supersedes: none
---

**What.** The validity double is registered in the conformance registry as "fake with native validity", lexical, so every registry-driven test runs on it.

**Why.** The card wants a store that claims the capability in the suite; registering it also puts it under the plane's cross-store acceptance, workload replay and revocation tests, which check that the plane ignores the flag.

**Result.** Those two plane files pass on it: 30 of 30 tests. The runner's store list is built elsewhere (`packages/runner/src/stores.ts` mentions the registry in a comment only), so no registered condition or committed result sees the double.

**Consequence.** Each registry-driven test file runs one more store, a few hundred milliseconds. If wrong, the double moves to the meta-test only.
