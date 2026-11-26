---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/parity-surfaces.test.ts
  - "make test-one T=packages/cli/test/tui/parity-surfaces.test.ts"
supersedes: docs/log/2026-11-22-e8-15d-change-parity.md
---

**What.** Parity of E8.15d's commands is `packages/cli/test/tui/parity-surfaces.test.ts`; this part's `parity.test.ts` is removed, so E8.15c's file of that name holds its own commands.

**Why.** Review finding E8.15d-8: once merged, E8.15c's screens open for its commands, and samples run through generated forms would test screens nobody sees; two files named parity.test.ts would also conflict.

**Result.** 22 tests. Each of the 14 commands opens through the router (log checkpoint its generated form, the rest a hand-made screen); every flag reaches the command line; retain, lint, simulate, export and import send the same requests and print the same bytes as `run` in process and, new, against a server (`listen` over a twin, review E8.15d-6); J equals `--json`; doctor, serve, mcp, the hook, key and log give the same line and output.

**Consequence.** The five older entries that cited `parity.test.ts` now cite this file.
