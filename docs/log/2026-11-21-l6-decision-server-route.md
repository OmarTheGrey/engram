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
  - packages/server/src/routes.ts
supersedes: none
---

**What.** The surfaces reach core through a new server route, although the card's file list names only the CLI and the MCP server.

**Why.** Since card E8.2, every CLI command and MCP tool is one generated-client call (ADR 0027), so there is no other path.

**Result.** packages/server/src/routes.ts, and the regenerated sdk/openapi.json.

**Consequence.** Three more shared surfaces (server, sdk, ui api) are touched; they are generated or additive.
