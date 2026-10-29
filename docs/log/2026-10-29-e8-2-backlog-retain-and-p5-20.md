---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - packages/cli/test/client.test.ts
  - packages/core/test/unit/no-bypass.test.ts
supersedes: none
---

**What.** Two Gate A follow-ups leave the backlog: `engram retain` and the CLI path spellings of review finding P5-20.

**Why.** The Gate B plan's scope names both, since PR 3 touches the CLI and moves the store-command check to core anyway.

**Result.** `engram retain --scope <scope>` sweeps as a user-sourced member; the check reads each word also as a normalised path and blocks `../cli` and `cli/src/main.ts`. Ten spellings are blocked by `packages/core/test/unit/no-bypass.test.ts`; removing the normalisation failed 2 of them.

**Consequence.** The backlog rows say where each was done; the cost of the wider block is in ADR 0014's amendments.
