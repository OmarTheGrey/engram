---
date: 2026-10-29
author: claude-agent
type: change
card: E8.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - packages/server/src/app.ts
  - packages/server/test/contract.test.ts
  - packages/server/test/security.test.ts
  - "pnpm --filter server test"
supersedes: none
---

**What.** Card E8.1: the HTTP server over core, a Hono app serving one route table (fourteen routes under `/api/v1`), with its OpenAPI 3.1 document built from the table by `z.toJSONSchema`.

**Why.** ADR 0027 makes one contract the path for every surface: the CLI, the MCP server and the inspector all call it.

**Result.** Contract tests hit every route through the generated client on the fake store and check each answer against its schema; every route is in the document. The loopback guard refuses a foreign Host, a foreign Origin, a non-JSON body and a body over 1 MiB, and sends no CORS header; `listen` refuses a non-loopback host. Each rule was broken on purpose and its test failed (Host 3 tests, Origin 1, content type 2, loopback 1). `pnpm --filter server test`: 41 passed.

**Consequence.** PR 4 builds the inspector on this server and the generated client in `packages/ui/src/api`.
