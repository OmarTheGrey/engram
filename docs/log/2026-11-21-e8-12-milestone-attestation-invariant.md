---
date: 2026-11-21
author: claude-agent
type: milestone
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/db/migrate.ts
  - packages/server/src/attest.ts
  - packages/server/test/attestation.test.ts
  - test/e2e/auth.e2e.test.ts
supersedes: none
---

**What.** The invariant holds: every event a served HTTP surface writes has a row in `event_attestations` (migration 6) naming an authenticated requester or the waiver.

**Why.** ADR 0042 decision 8; the event schema stays as it is (rule 5).

**Result.** The workspace's log handle writes the row inside the append's own transaction, from a per-request AsyncLocalStorage context. The test sends 48 seeded requests, four at a time, over a real socket to a SQLite file with the files store: keys, tokens and three kinds of refusal. Every event has its row. Each event's actor is the requester, or the store owner for adoption. Refusals append nothing. 2 passed. Mutation: skipping one row in seven fails both.

**Consequence.** Card E1.6 takes migration 5 in parallel; the runner tolerates the gap.
