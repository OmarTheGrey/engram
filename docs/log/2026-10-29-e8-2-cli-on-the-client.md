---
date: 2026-10-29
author: claude-agent
type: change
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/connect.ts
  - packages/cli/src/commands.ts
  - packages/cli/src/serve.ts
  - packages/cli/test/client.test.ts
  - "pnpm --filter cli test"
supersedes: none
---

**What.** Card E8.2 finished: read, write, promote, explain, retain, lint and simulate are each one client call, in process over the workspace their flags open or to `--server` (or `ENGRAM_SERVER_URL`); `engram serve` and `engram retain` are new.

**Why.** The card's acceptance asks for one client call per command and a help snapshot; the backlog asked for a user-sourced sweep of shared scopes.

**Result.** A counting transport shows exactly one request per command; every Gate A CLI test passes unchanged except the help snapshot and the list of unlanded commands, which `serve` left. `engram retain --scope team:platform` retires an expired shared item and refuses a non-member. `pnpm --filter cli test`: 162 passed.

**Consequence.** Exit codes are as before; lint and simulate still exit 2 naming L1 and E8.9.
