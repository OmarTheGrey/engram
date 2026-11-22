---
date: 2026-11-21
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/L6.md
  - packages/core/src/supersede.ts
supersedes: none
---

**What.** In the copied resolver, every id in an item's `lineage` is a link to its successor, where Remnic's item names one `supersedes`. Ids are not trimmed, and the result reports `head_id`.

**Why.** Engram's schema lists every superseded id, and its ids are UUIDv7s.

**Result.** Remnic's cases, adapted, in test/unit/supersede.test.ts; the blank-id cases were dropped.

**Consequence.** A promotion's lineage (several confirming episodes) reads as a fork; the smallest-id rule keeps that deterministic.
