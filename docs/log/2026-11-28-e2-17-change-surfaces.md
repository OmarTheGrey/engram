---
date: 2026-11-28
author: claude-agent
type: change
card: E2.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/cli/src/commands.ts
  - packages/cli/src/tui/screens/why-not.ts
  - packages/mcp/src/server.ts
  - packages/mcp/test/why-not.test.ts
  - make api-check
supersedes: none
---

**What.** POST `/api/v1/explain-absent` with its OpenAPI entry and generated clients (`make api`); `engram explain --absent <id> [query] [--at]` in the registry (home false); a TUI screen, Why not this item, opened with n from the item page and the read screen, with frames at both sizes and four modes; `memory_why_not`, listed only by `engram mcp --why-not`.

**Why.** The card names the route, the command and an MCP tool; the lead wants every surface connected.

**Result.** The route is in E8.16's HTTP leak suite (probes and the denied-and-missing comparison, no new pinned oracle), the command in the CLI and TUI leak and parity suites, the tool in MCP's; all pass with no leak. The TUI parity case runs read --item, events and explain --absent identically through the TUI and the CLI, in process and against a server.

**Consequence.** The inspector is not wired; the card does not name it.
