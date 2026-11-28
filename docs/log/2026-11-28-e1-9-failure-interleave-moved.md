---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/db/migrate-race.test.ts
supersedes: none
---

**What.** The first deterministic interleave ran the other migrate at this handle's first transaction, which after the fix is the table's creation, before the read; the re-read mutant survived it.

**Why.** Mutation check of the fix.

**Result.** The interleave now runs right after the first read of schema_migrations; the mutant fails it on both backends.

**Consequence.** nothing
