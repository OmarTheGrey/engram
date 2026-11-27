---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/main.ts
  - packages/cli/src/registry.ts
  - packages/cli/test/tui/entry.test.ts
supersedes: none
---

**What.** `engram tui` is a registry entry with its flags (`--line`, `--no-color`, `--high-contrast`, `--ascii`, `--reduced-motion`, `--no-mouse`, `--quiet`, `--no-saved`, `--screen`) and the workspace flags, its HELP line and options block, and the refusals of docs/design/tui.md 5.2.

**Why.** Card E8.15b; the TUI must never draw an escape sequence where it cannot run.

**Result.** `make test-one T=packages/cli/test/tui/entry.test.ts`: 17 passed. Each refusal prints its one line on stderr, exits 2 and writes nothing to stdout or the terminal; an unknown flag gets the CLI's usage error and its did-you-mean line; under Git Bash with a piped stdin the line suggests winpty. The help snapshot and the registry test gained tui's lines only. Mutation: dropping the stdin check fails 1 test.

**Consequence.** E8.15e replaces the `--line` refusal with line mode.
