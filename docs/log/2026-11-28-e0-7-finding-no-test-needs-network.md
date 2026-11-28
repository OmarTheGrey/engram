---
date: 2026-11-28
author: claude-agent
type: finding
card: E0.7
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - scripts/test/offline-guard.ts
  - scripts/test/offline-guard.test.ts
  - docs/conventions/testing.md
supersedes: none
---

**What.** Every test project passed under `ENGRAM_OFFLINE=1` with the guard on, so no test today reaches a host off this machine, and `PINNED_DATA_FETCH_TESTS` is empty.

**Why.** The card's risk was a test that silently needed the network; the full suite was run one project at a time to find one.

**Result.** Run as `ENGRAM_OFFLINE=1 pnpm exec vitest run --project <name>`, one project at a time: all sixteen exited 0, 6,932 tests passed, 44 skipped and 1 todo (core 3,161, cli 946, adapters 598, runner 591, bench 525, scripts 412, the rest under 250 each). The e2e layer was not run (the orchestrator runs it).

**Consequence.** The guard covers the test process only: a spawned `git`, `uv` or Python child is not patched, and `dgram` and `dns.Resolver` instances are not refused. A child fetching data is stopped by the code's own `ENGRAM_OFFLINE` refusals instead.
