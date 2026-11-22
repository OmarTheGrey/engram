---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/workspace.ts
  - packages/server/src/attest.ts
  - packages/bench/src/merit/seam.ts
  - packages/bench/src/tau2/plane.ts
supersedes: none
---

**What.** Only `openWorkspace`, the path the CLI's serve and mcp take, wraps the log in the attesting handle. `workspaceOf` keeps the caller's handle.

**Why.** Core's write queue is keyed by the handle. The MERIT and tau2 seams build a second Plane over the same raw handle, so wrapping it in `workspaceOf` would split their queue in two.

**Result.** Each bench seam changes by one line. `listen` now needs an explicit `auth`, so they pass `{ insecureLoopback: true }`. That keeps their behaviour, and writes no row because their handle does not attest.

**Consequence.** A library caller that serves a workspace and wants attestation passes `attestingDb(db)`.
