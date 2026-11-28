---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.9
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/verify.ts
  - docs/decisions/0038-tamper-evident-log-that-keeps-erasure.md
supersedes: none
---

**What.** For the lead: rewriting the genesis to version 1 and recomputing every link hides attestation edits like any whole-chain rewrite; and a writer from before this card cannot share a version 2 log unnoticed.

**Why.** What the chain version adds and does not.

**Result.** The rewrite is caught only by a checkpoint held outside the database, as ADR 0038 states for any rewrite (attacks.test.ts's genesis rewrite still fails at `checkpoints`). An old writer's unattested events are records version 2 writes alike, so they verify; an attested event it appends has a row but no digest and fails at `attestations`; an old verifier reads a version 2 genesis as one it does not write, FAILED.

**Consequence.** Operators should keep a held checkpoint, and upgrade every writer and verifier of a shared log together.
