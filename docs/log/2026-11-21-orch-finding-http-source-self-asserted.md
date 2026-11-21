---
date: 2026-11-21
author: claude-orchestrator
type: finding
card: E2.11
chapter: limitations
pillar: govern
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - docs/decisions/0040-trust-floors.md
  - docs/tasks/E8.12.md
supersedes: none
---

**What.** On the HTTP API the provenance source of a write is self-asserted: the server passes the request body's actor, source included, to `Plane.write`.

**Why.** The review of PR #69 checked ADR 0040's claim that every surface sets its source.

**Result.** The CLI, the MCP server, the Claude Code hook and the pi extension set a source themselves. The write route in `packages/server/src/routes.ts` does not, so an HTTP client may send no source or `source: user`. ADR 0040's floor covers the first case only. The registered runs use the plane in process through the pi extension, which sets the source.

**Consequence.** ADR 0040 states the limit, card E2.11 writes it into `docs/architecture.md`, and card E8.12's ADR maps a token to an actor and a source and ignores a client-sent source.
