---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/main.ts
  - test/e2e/tui.e2e.test.ts
supersedes: none
---

**What.** On the real console, L starts engram tui --line with the workspace's flags as a child process on the same terminal; the full screen prints its own commands first, and line mode prints its own as it ends. With an injected terminal (tests) the switch stays in the process.

**Why.** In the same process, stdin read again after raw mode lost the first line on Windows, and readline's own raw reading kept the process alive after quit (the failure entry). A child starts with a clean console state.

**Result.** The L smoke passes on ConPTY; by hand in conhost and mintty, L, a command and quit all worked.

**Consequence.** Two summaries after an L session instead of one. screen from line mode stays in the process: no raw mode precedes it.
