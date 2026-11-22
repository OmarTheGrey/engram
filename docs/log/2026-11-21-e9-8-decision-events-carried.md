---
date: 2026-11-21
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - docs/bundle.md
supersedes: none
---

**What.** A row's events are carried without their `item` state and are not replayed on import.

**Why.** An event's item state may hold content a later version took out, and replaying another log's decisions would record decisions this plane never made.

**Result.** The new log records the import's own decisions; the old ones travel for the record.

**Consequence.** None.
