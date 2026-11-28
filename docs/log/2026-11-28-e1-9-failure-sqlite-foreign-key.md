---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/log/attestations.test.ts
supersedes: none
---

**What.** The case of an attestation row naming no event failed on SQLite with "FOREIGN KEY constraint failed".

**Why.** The plane's SQLite handle enforces the foreign key from event_attestations to events.

**Result.** The case turns foreign keys off, as someone with database access can on SQLite, and runs on SQLite only; Postgres refuses such a row outright.

**Consequence.** nothing
