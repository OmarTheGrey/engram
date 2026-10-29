---
date: 2026-10-29
author: claude-agent
type: change
card: E8.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/scripts/api.ts
  - sdk/openapi.json
  - sdk/ts/src/index.ts
  - packages/ui/src/api/index.ts
  - "make api-check"
supersedes: none
---

**What.** Card E8.3: `make api` writes `sdk/openapi.json`, the TypeScript client `@engram/sdk` in `sdk/ts` (a workspace package) and the same client in `packages/ui/src/api`, every file by the generator.

**Why.** ADR 0027 decision 2: clients are generated from the contract, never written by hand, so a route change reaches every caller through `make api-check`.

**Result.** Types come from openapi-typescript 7.13.0, calls from openapi-fetch 0.17.0; `createEngramClient({ baseUrl, fetch })` takes an injected fetch, so a client bound to `app.fetch` calls a workspace in process. The server's contract tests round-trip every route through it. `make api-check` is clean after each commit of the branch.

**Consequence.** The CLI and the MCP server call this client; the inspector imports its copy.
