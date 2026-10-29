---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/commands.test.ts
  - packages/cli/test/client.test.ts
  - packages/server/src/workspace.ts
supersedes: none
---

**What.** Two failures while moving the CLI onto the client: the old test that `serve` exits 2 started a real server on port 7313 and waited its 30 s timeout, and `engram retain --owner dana` refused to run because `--owner` opened a files store that needs `--root`.

**Why.** `serve` had landed, so the not-landed test now ran it; the workspace opener treated `--owner` as a store flag although explain, retain and the hook use it only to name the actor.

**Result.** `serve` left the not-landed list and has its own tests on port 0 with a stop signal; a store opens only for `--root`, `--store` or a command that requires one.

**Consequence.** None beyond the fixes.
