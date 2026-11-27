---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/test/registry.test.ts
  - packages/cli/test/help-main.txt
supersedes: none
---

**What.** The command registry: one CommandSpec per command (26 entries), six groups, a `writes` function, and HELP, the command table and every handler's parse config built from it.

**Why.** Card E8.15a and docs/design/tui.md 6.1: the TUI's menus, forms and parity test need one description of the CLI, and a command added later should be one entry.

**Result.** `make test-one T=packages/cli/test/registry.test.ts`: 40 passed. The generator reproduces main's HELP (8046a6c2) byte for byte from main's entries; HELP differs only by the first line and the added commands' lines; every handler accepts exactly its entry's flags with their types, checked for every flag of every command. Mutations caught: key parsing log verify's flags (3 tests fail), one HELP word changed (2 fail).

**Consequence.** E8.15b builds the `tui` entry and its screens on REGISTRY.
