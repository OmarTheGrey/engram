# ADR 0033: The model-call layer is its own package, @engram/model

Status: proposed, 2026-11-06 (numbered 0032 until 2026-11-13, renumbered because card E8.9's simulator ADR, PR #28, took 0032 first)
Deciders: drafted by the agent working the backlog item "`@engram/bench` and `@engram/runner` import each other" (step 1 of the lead's delegation list, owner Shady); for the lead's acceptance
Supersedes: nothing; it settles the backlog item's open choice ("a package both import, or into core where they are types").

## Context

`@engram/bench` imported `cached`, `memoryCache`, `fileCache`, `OfflineMissError` and the cache types from `@engram/runner`, and the runner imports bench's `gatemem` and `memInvBench` namespaces, so the two packages formed a cycle. A top-level use of one in the other read an unset binding at load (`docs/log/2026-10-29-b3-failure-bench-runner-import-cycle.md`). The shared code is `packages/runner/src/model/cached.ts` (imports Node and `@engram/core` only) and, for one bench test, `packages/runner/src/model/scripted.ts` (imports pi-ai's faux provider).

## Decision

A new workspace package, `packages/model` (`@engram/model`), holds the cached, seeded model call of ADR 0017 (`cached.ts`) and the scripted models (`scripted.ts`), with their tests. It depends on `@engram/core` and `@earendil-works/pi-ai` 1.3.0 (already pinned), never on bench or runner. Bench imports it instead of the runner and no longer depends on the runner. The runner imports it and re-exports it from its index, so code importing these names from `@engram/runner` is unchanged. Two paths stay where they were because immutable log entries cite them as evidence and `make lint-docs` checks every cited path: `packages/runner/src/model/cached.ts` is a one-line re-export of `@engram/model`, and `packages/runner/test/model/cached.test.ts` stays in the runner and tests the cache through `@engram/model`.

## Alternatives considered

(a) Types into core and the cached call into bench: core may hold the types but not a model call (AGENTS.md rule 4 keeps the plane free of model calls, and the cache writes files), and the runner would then import its own cache from a benchmark package. (b) Keep the runner as a dev dependency of bench for the scripted model: the cycle would remain in the graph through tests. (c) Lazy access only (the B3 workaround): it hides the cycle rather than removing it.

## Consequences

`@engram/bench` loads alone and both packages may use each other's exports at module top level (`packages/bench/test/load.test.ts`, `packages/runner/test/load.test.ts`). `@engram/model` may import pi-ai, so it is not in biome's no-pi-import list; it stays free of bench and runner, which the load test checks. The rest of `packages/runner/src/model/` (cassette, pi, retry, provider keys) stays in the runner. Unblocks card B5's harness (step 9), which uses the cache from bench.
