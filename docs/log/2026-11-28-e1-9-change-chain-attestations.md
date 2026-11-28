---
date: 2026-11-28
author: claude-agent
type: change
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - packages/core/src/log/verify.ts
  - packages/core/test/unit/log/attestations.test.ts
supersedes: none
---

**What.** Chain version 2: each event's attestation row is digested into its chain entry, in the transaction that appends it, and `verifyChain` gains an `attestations` check, a `version` field and two counts.

**Why.** An edited attestation verified clean (docs/log/2026-11-21-e1-6-review-decision-attestations-on-main.md).

**Result.** Before: a chain entry held the commitments only; CHAIN_VERSION 1. After: the entry holds `attestation: sha256:...` when the event has a row; a row edited (each of six columns), deleted, swapped or added after its event fails at `attestations`; a version 1 chain verifies, gains one `version` entry at the next kept append, and counts its rows as `attestations_uncovered`. attestations.test.ts: 9 cases on SQLite and Postgres. Mutating the digest comparison fails 8 tests.

**Consequence.** ADR 0038 has an amendment of 2026-11-28; architecture.md says so.
