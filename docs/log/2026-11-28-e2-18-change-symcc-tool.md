---
date: 2026-11-28
author: claude-agent
type: change
card: E2.18
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/src/main.rs
  - tools/symcc/properties.ts
  - tools/symcc/cli.ts
  - scripts/test/symcc-properties.test.ts
  - scripts/test/symcc-invariants.test.ts
  - "make test-one T=scripts/test/symcc-properties.test.ts"
supersedes: none
---

**What.** tools/symcc: a Rust binary that asks cedar-policy-symcc whether one Cedar policy set implies another for every request of an action, and TypeScript that writes the preset checks over exportCedar and replays each counterexample through evaluateRead or evaluateWrite.

**Why.** ADR 0041, decision 6 left proofs to a follow-up card.

**Result.** Cedar's own authorizer rechecks every counterexample. The decoder encodes its answer back and reports any decode that does not round-trip, and its names do not depend on Cedar's entity order. The job hashes both sides of every check and carries the three domains and every invariant's permit, all copied into the result. symcc-invariants.test.ts decides each permit with cedar-wasm against its TypeScript statement on a grid of requests on both sides; weakening a permit fails it. 13 and 5 tests pass.

**Consequence.** make verify-policy and the result script are built on it.
