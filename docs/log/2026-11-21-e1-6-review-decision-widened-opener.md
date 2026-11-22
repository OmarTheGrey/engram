---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/workspace.ts
  - packages/server/test/chain.test.ts
supersedes: docs/log/2026-11-21-e1-6-decision-opt-in-handle.md
---

**What.** Under the lead's decision on review finding E1.6-1, the card is widened to packages/server: the shared opener, openWorkspace().open(), keeps the chain for every log it opens, and the CLI's own calls are gone.

**Why.** The pi package opens the same default home log through openWorkspace and kept no chain, so one pi event made a legitimate log verify FAILED for good.

**Result.** A pi-package workspace and a CLI workspace on one SQLite file, with an offboarding between them, verify with no broken link, no unchained event and one manifest. The bench seams use workspaceOf, which keeps no chain (tested), and the runner reaches neither, so no registered run and none of X15's query counts change; no opt-out was needed.

**Consequence.** Every surface (CLI, serve, mcp, hook, pi package) chains its events.
