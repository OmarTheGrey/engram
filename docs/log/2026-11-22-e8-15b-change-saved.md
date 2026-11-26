---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/saved.ts
  - packages/cli/src/tui/clipboard.ts
  - packages/cli/test/tui/saved.test.ts
supersedes: none
---

**What.** `<home>/.engram/tui.json` holds the workspace flags and the TUI's options only, written 0600 through a rename, with Forget saved workspace in the workspace panel and the palette; copying goes by OSC 52, pi-tui's native clipboard, or is printed on quit.

**Why.** docs/design/tui.md 8.3 and 4.1.

**Result.** `make test-one T=packages/cli/test/tui/saved.test.ts`: 9 passed. Unknown keys are dropped on write and read; a postgres URL is saved as doctor redacts it and a server URL without userinfo or query; after first run and the first loop the file holds no content, item or read id and no ENGRAM_TOKEN value. Mutations: saving a postgres URL whole fails 1 test; writing under `--no-saved` fails 1.

**Consequence.** Card E8.12's `--keys` path is a saved flag; a key itself never is.
