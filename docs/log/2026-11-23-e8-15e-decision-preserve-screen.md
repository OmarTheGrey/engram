---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - test/e2e/tui.e2e.test.ts
supersedes: none
---

**What.** Quitting stops pi-tui with preserveScreen, so the terminal comes back as it was, instead of pi-tui's default of printing the last frame into the scrollback.

**Why.** The first smoke showed the last frame in the main buffer after quit. A frame can hold memory content, which then stays in the scrollback; before line mode it is noise a screen reader reads; the design prints only the session's commands.

**Result.** The smokes check the text after quit holds the summary and not Home's rows; by hand, conhost, Windows Terminal and mintty all showed the shell's screen and the summary.

**Consequence.** Under mintty with a pseudoconsole the lines printed before the TUI did not reappear: ConPTY repaints its own view of the screen.
