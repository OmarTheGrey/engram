---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - packages/cli/src/run.ts
supersedes: none
---

**What.** One command registry, `packages/cli/src/registry.ts`, describes every command, flag, default, help line, exit code and write class; `run.ts`, `HELP`, the TUI's menus, palette, forms, help overlay and parity test all read it.

**Why.** Cards in flight add commands (export, import, who-can-read, key, log verify, supersede). With one registry a new command is one entry that appears in `--help` and the TUI at once, with no TUI code and no redesign.

**Result.** Section 6.1 gives the entry's shape; the existing help snapshot proves the registry reproduces `HELP` byte for byte before anything is added.

**Consequence.** E8.15a builds it first, after E9.8 and E2.13 merge, so it is written once with their commands in it. If wrong, the TUI hard-codes its menus and drifts from the CLI.
