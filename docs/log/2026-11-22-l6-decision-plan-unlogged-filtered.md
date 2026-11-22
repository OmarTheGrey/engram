---
date: 2026-11-22
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/server/test/supersede.test.ts
supersedes: docs/log/2026-11-21-l6-decision-plan-unlogged.md
---

**What.** Asking for a plan without `accept` still appends no event.

**Why.** With the read filter applied (L6-1), a plan names only ids, instants and reasons of items the actor could read. Like `/events` and the who-can-read view, it is a view of what the reader may already see. The earlier entry's claim that it returned no hidden content was false before the fix.

**Result.** The 'writes nothing' tests in the server, CLI and MCP suites, and the leak property.

**Consequence.** If the lead reads rule 3 as covering this view, the plan needs a read event.
