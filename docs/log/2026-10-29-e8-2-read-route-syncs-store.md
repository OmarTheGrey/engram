---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.2
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
  - docs/decisions/0027-http-contract-client-and-inspector.md
supersedes: none
---

**What.** The read route runs the store owner's retention sweep and adoption before `Plane.read` when the workspace has a store, and returns their reports as `sync`.

**Why.** `engram read` made three plane calls (retain, adopt, read); one client call per command needed the server to run the first two, in the same order (retention before adoption, ADR 0025).

**Result.** The CLI prints its Gate A lines from one call, and its read tests pass unchanged. The `sync` report is not filtered by reader; recorded as a limit in ADR 0027's amendments.

**Consequence.** A server with authentication must filter `sync` through `visibleEvents` or by owner before it serves other machines.
