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

**What.** Asking for a plan without `--accept` writes no event.

**Why.** Like `/events`, the plan is a view over the projection filtered by the read matrix. It changes nothing and returns no content, only ids, dates and reasons.

**Result.** The 'writes nothing' tests in the server, CLI and MCP suites.

**Consequence.** If the lead reads rule 3 as covering the filter, the plan needs a read event, as `Plane.read` has.
