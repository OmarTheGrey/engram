---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/scrub.ts
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-d1-decision-hold-identifiers.md
---

**What.** The hold rule of the superseded entry stands: identifiers are checked, never rewritten, and pi's id shapes pass. One change: names that are long by design (a tool name such as `mcp__server__tool`, a model id, a custom type, a stop reason) are checked without the table's rule for a run of 32 or more key characters (`redactSecrets(text, { longTokens: false })`).

**Why.** The review found that MCP-style tool names and long model ids would hold sessions that hold no secret.

**Result.** A long tool name passes, and `mcp-x-sk-...` is held. A key glued to a name with underscores (`mcp__x__sk-...`) has no word boundary for the `sk-` rule and passes: a tested, known limit. A hold still leaves no event, and a backlog row names the Plane method it needs.

**Consequence.** Card E2.9 or a later card adds the event.
