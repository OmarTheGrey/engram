---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.7
chapter: design
pillar: research
hypothesis: none
evidence:
  - scripts/test/offline-guard.ts
  - scripts/test/offline-guard.test.ts
supersedes: none
---

**What.** The offline guard refuses every host but the loopback (localhost, 127.0.0.0/8, ::1) and lets local sockets (a `path`) through; `fetch` of a `data:`, `blob:` or `file:` URL is left alone.

**Why.** The card says any socket, DNS or fetch call, but the embedded Postgres, the HTTP server and the MCP server are tested over 127.0.0.1, and a loopback connection reaches no network. Refusing it would break hundreds of tests that are offline in every sense the variable means.

**Result.** A test asserts loopback sockets, http and fetch still work under the guard, and that 0.0.0.0, 10.0.0.1, `localhost.example.com` and `::2` are not loopback.

**Consequence.** If wrong, a test talking to a service on this machine on purpose (not a store or a model) would hide a dependency; none exists today.
