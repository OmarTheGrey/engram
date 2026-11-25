---
date: 2026-11-25
author: claude-agent
type: failure
card: none
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/cli/scripts/tui-screens.ts
  - docs/design/screens/write-deny.ansi
supersedes: none
---

**What.** The first captures drew the workspace folder's absolute path, which named this machine's user and temp folder. It appeared in the write result's log line, Doctor, the Serve start line, the MCP snippet and line mode.

**Why.** The CLI prints the SQLite log's resolved path, and the MCP snippet makes every path absolute on purpose (design 8.15). The frames therefore differed by machine and could not be compared byte for byte.

**Result.** The script now shows the workspace folder as `~/demo`, as the design's mockups do. It changes only the printed text of each result, never the call that was made, and it does so before the TUI wraps the text. screens.test.ts asserts that no frame names the folder.

**Consequence.** index.md says that paths are shown as ~/demo.
