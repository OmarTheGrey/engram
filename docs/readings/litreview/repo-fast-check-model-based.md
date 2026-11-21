---
id: repo-fast-check-model-based
title: fast-check model-based testing (commands, scheduler) and fuzzing options
authors: Nicolas Dubien (dubzzz)
venue: open-source tool
year: 2026
tier: new
topics: [methods, testing, property-based, stateful]
engram: [plane, H1]
code: https://github.com/dubzzz/fast-check (MIT, 5296 stars, pushed 2026-11-21, latest release v4.10.3; verified with gh api); Engram pins 4.10.2
sources_read: [https://github.com/dubzzz/fast-check, https://fast-check.dev/blog/2025/03/28/beyond-flaky-tests-bringing-controlled-randomness-to-vitest/]
---

## Claim
fast-check's `fc.commands`, `fc.asyncModelRun` and `fc.scheduler` generate sequences of operations against a real system and a simple model, shrink failures to a minimal command list, and reorder async steps from a seed.

## Method
A command has `check(model)`, `run(model, real)` and a `toString`; `fc.commands([...])` yields arrays that `fc.asyncModelRun` executes, asserting after each step. `fc.scheduler()` controls the interleaving of promises, so a concurrent-writer race is a reproducible, shrinkable seed.

## Key numbers
- None stated in the sources read.

## What Engram borrows
A `PlaneMachine` test: commands write, read, changeGrants, promote, retain, offboard, adopt and reopen a handle; the model is an independent projection; the seven invariants are checked after every step, not only at the end (AB-FRM-3). The invariants file already runs a two-handle walk under `fc.scheduler()` with crashed writers (card E2.6, `twoHandleWalk`), so AB-FRM-4 was dropped as a duplicate. No new dependency, since fast-check 4.10.2 has these APIs.

## What Engram does differently
The existing invariants generate whole cases at once; a state machine reaches long sequences (write, grant, offboard, adopt) that independent cases rarely compose.

## Risk to our claims
A model sharing code with `policy/evaluate.ts` makes the test vacuous; keep the model independent.

## Open question
Can embedded-Postgres tests share the generators, or is SQLite with two handles enough?

## Notes
Native vitest fuzz mode was only a future idea in the 2025 post. Coverage-guided fuzzing: Jazzer.js (Apache-2.0, 368 stars, pushed 2026-11-09) has a Jest integration, and no Vitest runner was found; Vitiate (mjkoo/vitiate, MIT, 2 stars) is too immature. Fuzzing is low priority; use fast-check on schema parsers and MCP inputs.
