---
date: 2026-11-21
author: claude-agent
type: failure
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/commands.test.ts
  - packages/cli/test/supersede.test.ts
supersedes: none
---

**What.** Two CLI expectations were wrong on the first run: the new test expected exit 2 for the server's 400, and the help test's verbatim copy of the help text did not list the new command.

**Why.** The CLI maps a 400 to CallError (exit 1), and commands.test.ts holds the help text byte for byte.

**Result.** `pnpm exec vitest run packages/cli/test/` gave 2 failed, 187 passed. The expectation became exit 1, and the copy was updated with the same text as run.ts.

**Consequence.** None.
