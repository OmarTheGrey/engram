---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/test/registry.test.ts
supersedes: none
---

**What.** After cliupgrade-b merged into cliupgrade, the `tui` entry gained the `env` field E8.15a's later fixes require, and the registry test gained `tui`'s rows in its `writes` table; its environment scan now reads subfolders of `src`, so the TUI's own reads are held to the entry too.

**Why.** The merge had no textual conflict, but tsc refused the `tui` entry without `env`, and two registry tests failed on it.

**Result.** The `tui` entry names the plane's variables and the 21 the TUI reads itself (its options, the refusals, the terminal and the shell). `make test-one T=packages/cli/test/registry.test.ts`: 46 passed; dropping COLORFGBG from the list fails the scan. `writes` is `process` for `tui` under every condition, each action asking by its own entry.

**Consequence.** A variable a later TUI part reads must be named on the `tui` entry.
