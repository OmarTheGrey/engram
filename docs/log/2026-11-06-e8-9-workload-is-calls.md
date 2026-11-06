---
date: 2026-11-06
author: claude-agent
type: decision
card: E8.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0032-simulator-replays-recorded-calls.md
  - packages/core/src/simulate.ts
supersedes: none
---

**What.** A simulator workload is the plane calls a run made (actors, then write, read, retain and promote steps), replayed through the plane's own write, read, retention and promotion code on an in-memory log and store per policy; proposed as ADR 0032.

**Why.** Card E0.3's `{ id, events }` could not be decided again: a denied write's event has no item, a read's event no query, and an event's actor no memberships.

**Result.** The shape matches the inspector's fixture workload; the HTTP contract, the client, the pi extension and the MCP server use it. The utility proxy is items returned by reads, the proxy ADR 0025 names.

**Consequence.** The lead accepts or amends ADR 0032; until then it is listed as owner-decides.
