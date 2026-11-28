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
  - "make test-one T=scripts/test/symcc-properties.test.ts"
supersedes: none
---

**What.** tools/symcc: a Rust binary that asks cedar-policy-symcc whether one Cedar policy set implies another for every request of an action, and TypeScript that writes the preset checks over exportCedar and replays each counterexample through evaluateRead or evaluateWrite.

**Why.** ADR 0041, decision 6 left proofs with Cedar's analyser to a follow-up card once the export was trusted; card E2.12's differential test samples, a solver proves.

**Result.** The binary knows nothing of Engram: a job names the schema, two policy sets and an action, and Cedar's own authorizer rechecks every counterexample before it is returned. The TypeScript decodes a counterexample into an actor, item and time, encodes it back with cedarReadRequest or cedarWriteRequest, and reports any decode that does not round-trip. 11 tests pass.

**Consequence.** make verify-policy and the result script are built on it.
