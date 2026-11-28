---
date: 2026-11-28
author: claude-agent
type: change
card: E0.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/offline-guard.ts
  - scripts/test/offline-guard.setup.ts
  - scripts/test/offline-guard.test.ts
  - vitest.shared.ts
  - docs/conventions/testing.md
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run --project scripts scripts/test/offline-guard.test.ts"
supersedes: none
---

**What.** An offline guard: under `ENGRAM_OFFLINE=1`, a setup file every project loads through `vitest.shared.ts` makes `fetch`, `net.Socket#connect` and every `node:dns` resolver throw at once for any host but the loopback, naming the host.

**Why.** Cards L7 and X14 met tests that broke only under the variable; a test that reaches the network should fail at once with a clear message, not hang or pass only online. Ideas from Compartment's `offline_guard.py` and Scuttie's hidden-call audit (both Apache-2.0, no code copied).

**Result.** `scripts/test/offline-guard.test.ts`: 16 tests pass under the variable, 14 pass and 2 skip without it. Mutant (every host counted as loopback) killed: 8 tests failed. Tests that fetch pinned data lift it with `allowPinnedDataFetch` and are listed; none needs it today.

**Consequence.** A test that silently needed the network is red under CI's variable, with the host in the message.
