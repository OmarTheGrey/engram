---
date: 2026-11-21
author: claude-agent
type: finding
card: E8.12
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/app.ts
  - packages/cli/src/mcp.ts
  - packages/cli/test/client.test.ts
supersedes: none
---

**What.** Three things later cards need to know.

**Why.** Each is outside this card's files or scope.

**Result.** First, the inspector sends no credential. On a server with credentials its page loads and every API call answers 401, so it works under `--insecure-loopback` only. Second, `engram mcp --http --server <url>` forwards with the MCP process's own `ENGRAM_TOKEN`, so that server refuses a session of another actor (`forbidden_actor`). Third, the tests that relied on tokenless loopback now pass `--insecure-loopback`: three in `packages/cli/test/client.test.ts`, and the `listen` and `serveHttp` calls in the server, mcp and e2e tests. The help snapshot and doctor's check list gained the new lines.

**Consequence.** A UI card gives the inspector a credential. Offboarding treats a token subject as it treats actor ids.
