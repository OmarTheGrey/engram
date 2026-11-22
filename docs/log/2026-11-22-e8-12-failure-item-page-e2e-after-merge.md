---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - test/e2e/item-page.e2e.test.ts
  - packages/server/src/listen.ts
  - packages/mcp/src/transports.ts
supersedes: none
---

**What.** After merging main, `make lint` failed on two type errors. Commit 207bd829 fixed both.

**Why.** Main brought card E8.11's `test/e2e/item-page.e2e.test.ts`, which calls `listen` without `auth`. `listen` now requires `auth`, so a caller must choose between credentials and the waiver. Separately, `serveHttp`'s options type lacked the `clock` the new MCP auth test passes.

**Result.** `tsc` reported TS2741 ("Property 'auth' is missing") at item-page.e2e.test.ts lines 162 and 434, and TS2353 at packages/mcp/test/auth.test.ts line 73. The e2e test now passes `auth: { insecureLoopback: true }`, `serveHttp` declares `clock`, and `make lint` exits 0.

**Consequence.** A later card that calls `listen` or `serveHttp` must state its auth. Cards E2.13, E8.14 and E9.8 should expect the same compile error after they merge.
