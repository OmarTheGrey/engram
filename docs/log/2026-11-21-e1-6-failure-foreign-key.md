---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/chain.test.ts
supersedes: none
---

**What.** The first run of the chain property failed with FOREIGN KEY constraint failed while deleting a read event.

**Why.** explanations.read_id references events.id (migration 3), so a tamper deleting or renumbering a read event was refused by SQLite before the verifier saw it.

**Result.** The clean verification had already passed. The tampers now delete the affected explanation rows first, as a tamperer with database access would.

**Consequence.** The tamper matrix models a tamperer who respects the schema's own constraints.
