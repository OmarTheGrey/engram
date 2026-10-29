---
date: 2026-10-29
author: claude-agent
type: change
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/workspace.ts
  - packages/cli/test/letta.test.ts
  - test/e2e/cli.e2e.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** The workspace opener every surface uses (moved to `packages/server` by PR 3) takes `--store letta --root <MemFS folder> --owner <id>`, so `engram read`, `write`, `promote`, `retain`, `serve` and `mcp` act on a Letta MemFS repository; the help text, AGENTS.md and CLAUDE.md say so.

**Why.** The Gate B plan has whichever of PR 2 and PR 3 merges second wire the Letta store into the workspace and the CLI smoke; PR 3 merged first (17407d5).

**Result.** `packages/cli/test/letta.test.ts` writes, reads and explains on a temporary MemFS repository (one commit for the allowed write, none for the denied one) and checks the refusals; `make test-e2e` runs the same smoke with the binary on SQLite and embedded Postgres, 15 tests passing. The branch was rebased onto 17407d5, with conflicts in `packages/cli/src/run.ts` and `packages/cli/test/helpers.ts` resolved by keeping both sides.

**Consequence.** Every surface reaches Letta; Mem0 still needs an embedding model at the surface.
