---
date: 2026-11-22
author: claude-agent
type: finding
card: E9.8
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/server/src/auth.ts
  - packages/server/src/app.ts
  - packages/core/src/portable.ts
supersedes: none
---

**What.** On a server with credentials (card E8.12), the credential's source replaces the import actor's per-row source, so the cap of E9.8-1 holds only as far as the credential's source does.

**Why.** `bindActor` returns the held actor's source (`packages/server/src/auth.ts`, `source: held.source`): a source sent by an authenticated client is ignored, by design (ADR 0042).

**Result.** An import over `--server` must authenticate as `import:<importer>`; a key issued with source `import` records a model row as `import`. Found by reading after the merge with E8.12; no test pins it.

**Consequence.** For the lead: either the cap moves into Plane.write for any `import` source (the oracle's `effectiveKind` changes with it), or import keys are issued at the least trusted kind. In process and on `--insecure-loopback` the cap holds.
