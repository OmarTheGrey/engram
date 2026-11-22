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
supersedes: none
---

**What.** `packages/cli/test/tui/parity.test.ts`, its cases in "E8.15d" describe blocks, over every registry command.

**Why.** docs/design/tui.md 3.8 and 13 and the card's acceptance; E8.15c adds its screens' cases in blocks of its own.

**Result.** 29 tests pass. Every command but `tui` has a screen; every flag but `--json` has a control whose value becomes that flag, each screen choice tried, with and without a server. For the 17 client commands the line a screen shows parses to the sample's meaning, and running it from the screen sends the same requests (method, path, body) and prints the same bytes and exit code as `run` on a twin workspace, ids, folders and keys normalised; J equals the `--json` run where a screen offers it. Doctor, serve, the hook, mcp, the key commands and log verify and checkpoint give the same command line and output.

**Consequence.** A screen that drops a flag fails here.
