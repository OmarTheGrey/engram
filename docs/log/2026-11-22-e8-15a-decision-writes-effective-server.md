---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15a
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/test/registry.test.ts
supersedes: docs/log/2026-11-22-e8-15a-decision-writes.md
---

**What.** `writes` keeps the answers of the earlier entry, and the workspace's server it reads is the effective one: `workspaceFlags(ws, env)` fills it from ENGRAM_SERVER_URL when no --server is given, as connect does.

**Why.** The lead's decision in the E8.15a review: a read through the variable's server may sweep as one through --server does.

**Result.** A table in the registry test pins all 26 entries with each condition flipped (`accept` empty or not, `out`, root, store, server in the form or the workspace); a second test pins the variable, an empty value naming no server.

**Consequence.** The TUI's workspace passes its flags through `workspaceFlags`.
