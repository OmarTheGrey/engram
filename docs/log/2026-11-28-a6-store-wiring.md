---
date: 2026-11-28
author: claude-agent
type: change
card: A6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/workspace.ts
  - packages/cli/src/registry.ts
  - packages/cli/src/doctor.ts
  - packages/cli/test/mcp-memory.test.ts
  - test/e2e/cli.e2e.test.ts
supersedes: none
---

**What.** The store is wired into every place one is chosen: the workspace opener (`WORKSPACE_STORES`), the CLI's `--store` choices and help, the TUI's store picker, `engram doctor`'s adapter checks (`adapter mcp-mem`) with the TUI machine screen's text, and the e2e CLI smoke.

**Why.** The lead wants every surface connected; a store only the conformance suite can reach is not usable.

**Result.** `vitest run packages/cli/test`: 948 tests, all passing after the eight workspace frames were updated on purpose (the picker gains `( ) mcp-memory`); `packages/server/test`: 156 passing; `test/e2e/cli.e2e.test.ts`: 16 passing, the new case on SQLite and embedded Postgres.

**Consequence.** The help reference `packages/cli/test/help-main.txt` and the help snapshot in `commands.test.ts` changed with the `--store` and `--root` lines.
