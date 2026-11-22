---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.6
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/db/migrate.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** For the lead: two processes creating a fresh log at once can fail with "table events already exists".

**Why.** migrate reads schema_migrations outside its transaction, so both processes see migration 1 pending and the second one's CREATE TABLE fails; reported by the verification of card E1.6, and it predates the card.

**Result.** Not fixed here (out of the card). A backlog row names it.

**Consequence.** A core card should re-read schema_migrations inside each migration's transaction and skip a migration another process applied.
