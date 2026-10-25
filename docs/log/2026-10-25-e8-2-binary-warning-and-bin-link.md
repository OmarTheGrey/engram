---
date: 2026-10-25
author: claude-agent
type: failure
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/main.ts
  - packages/cli/test/main.test.ts
  - Makefile
supersedes: none
---

**What.** Two things failed when the CLI first ran as a process: Node printed an ExperimentalWarning for node:sqlite on stderr, and `pnpm --filter cli exec engram` answered that the command was not found.

**Why.** Loading core loads node:sqlite, which warns on every start. pnpm does not link a workspace package's own `bin` into its own `node_modules/.bin`.

**Result.** `main.ts` drops that one warning, then imports the command table, so the spawned tests see an empty stderr. `make engram ARGS="..."` runs `node packages/cli/src/main.ts` instead of the pnpm route; the `bin` entry stays for when a package depends on the CLI.

**Consequence.** AGENTS.md lists `make engram` as the way to run the CLI from the repository.
