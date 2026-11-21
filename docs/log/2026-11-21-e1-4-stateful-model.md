---
date: 2026-11-21
author: claude-agent
type: change
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - "make test-one T=packages/core/test/property/stateful.test.ts"
  - "ENGRAM_STATEFUL_RUNS=6000 make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: none
---

**What.** A fast-check command model (`fc.commands`, `fc.asyncModelRun`) over write, read, grant change, promote, retain, offboard, adopt, handle reopen and clock advance, with crash windows, on the real Plane, the fake store and an injected clock.

**Why.** Failures come from sequences; the invariants file checks single operations and one two-handle walk.

**Result.** After every command: the dogfood report's oracle replay, invariants 1 to 7, erasure, the frozen scope, and the store against the projection until a crash; each run ends with recovery to a fixed point. A failure prints seed, path and shrunk commands. Default 200 runs in about 3 s; deep runs of 6,000 and 5,000 (seed 1) pass with the pins. Two vacuity checks (a leaky read, a gate bypass) are caught, shrunk to at most 3 and 2 commands. Mutation check: a gate ignoring an open erasure is caught in three commands.

**Consequence.** Findings E14-F1, E14-F3 and E14-F4.
