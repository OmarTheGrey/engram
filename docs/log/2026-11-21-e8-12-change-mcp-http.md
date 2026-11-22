---
date: 2026-11-21
author: claude-agent
type: change
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/transports.ts
  - packages/cli/src/mcp.ts
  - packages/mcp/test/auth.test.ts
supersedes: none
---

**What.** `engram mcp --http` takes the same credential flags. Each MCP session is built for its credential's actor with source `model`, and no other credential can use it.

**Why.** ADR 0042 decision 4, and the MCP authorization specification.

**Result.** A 401 names `/.well-known/oauth-protected-resource/mcp`. The events of a session's calls are attested `mcp_http`. Eve's key on Dana's session is 403. `make test-one T=packages/mcp/test/auth.test.ts`: 3 passed. Mutation: without the session check the hijack test fails. stdio is unchanged and refuses credential flags; the harness fixtures are untouched.

**Consequence.** H4's MCP surface (stdio) does not move.
