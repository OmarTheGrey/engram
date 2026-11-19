---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/src/schema.ts
supersedes: none
---

**What.** The report judges reads by the actor the member declares (`--as`, `--level`, `--member`, as given to `engram serve` and `engram mcp`), and any other principal as the CLI builds it from `--as` alone.

**Why.** An event records only the actor's id: no level, memberships or source, so the oracle cannot be given the reader's capacity from the log.

**Result.** A member who changes flags mid-run must say so; a declared membership the server never had hides nothing, but a narrower one flags reads (tested). The source of an `engram/grant/change` event is not in the log either: the report trusts the gate's user-only rule there, and checks the source only for writes, whose provenance records it.

**Consequence.** Recording the actor's capacity in events is a schema change (AGENTS.md rule 5), a backlog row.
