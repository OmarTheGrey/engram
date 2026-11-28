---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.16
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage-kit.ts
supersedes: docs/log/2026-11-28-e8-16-decision-parity-fields.md
---

**What.** Parity compares each event's op, item id, actor, scopes, decision, reason and rule id, and its item's class, scope, owner, content, confidence, validity, ttl, grants, lineage, status, version and provenance kind and actor; it leaves out the provenance ref and hash (each surface's label), the store ref, the item id (item_id carries it), schema_version, and the event's id, seq, ts and chain fields (ids are blind, the clock fixed).

**Why.** The first entry said nothing else was left out, which was not so (review finding 8).

**Result.** The snapshot gained ttl and provenance; MCP, the HTTP API and pi agree on it.

**Consequence.** None beyond the comparison.
