---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/log/chain.test.ts
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-e1-6-decision-attestations-outside.md
---

**What.** Card E8.12 is on main (migration 6, event_attestations); its rows stay outside the chain.

**Why.** Review finding E1.6-8: the earlier entry said E8.12 was not merged.

**Result.** Migration 5 applies after main's real migration 6 already applied and before it on a fresh log, on SQLite and Postgres (chain.test.ts). An edited attestation row verifies clean today; the test asserts it, architecture.md and the backlog row say so.

**Consequence.** A later card adds each event's attestation digest to its chain record.
