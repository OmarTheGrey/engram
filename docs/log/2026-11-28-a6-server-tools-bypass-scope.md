---
date: 2026-11-28
author: claude-agent
type: finding
card: A6
chapter: limitations
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/src/no-bypass.ts
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-28-a6-server-tools-bypass.md
---

**What.** The bypass through the MCP memory server's own tools is narrower and worse than the first entry said: the real one is `delete_entities` on an `engram:<id>` entity, which removes a governed item with no event, and for an item outside the owner's person scope nothing ever retracts it.

**Why.** The first entry said what those tools change is adopted or retracted at the next read, but adoption retracts only items of the scope it adopts (`held.scope === scope` in adopt.ts); the server's create and add tools only make imported records, which adoption gates.

**Result.** A hook rule now denies the server's `delete_entities`, `delete_observations` and `delete_relations` under any `mcp__<name>__` prefix, a partial layer (Claude Code and pi only). The store-loss event is a backlog row, its own card after H1, by the orchestrator's decision.

**Consequence.** The thesis states store loss outside the owner's scope as a limitation until that card.
