---
date: 2026-11-22
author: claude-agent
type: milestone
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/attestation.test.ts
  - packages/mcp/test/attestation.test.ts
  - packages/mcp/src/transports.ts
supersedes: docs/log/2026-11-21-e8-12-milestone-attestation-invariant.md
---

**What.** A correction. The earlier entry said the invariant held on every served HTTP surface, but it had been tested on the API alone. On the MCP transport it was false. An encoded path let a call with no credential write, and the write was attested `insecure_loopback`/`unattributed` on a server with credentials (finding E8.12-1).

**Why.** Review finding E8.12-2.

**Result.** A second seeded test runs on `serveHttp` with credentials: one session per key, 40 steps four at a time, with refusals (no credential, `/%6Dcp`, a revoked key, another credential). Every event has its row on `mcp_http`, with method `jwt` or `api_key`, naming the event's own actor; no refused call left an event. 1 passed, and it fails when the E8.12-1 bug is put back.

**Consequence.** The invariant is now tested on both served surfaces.
