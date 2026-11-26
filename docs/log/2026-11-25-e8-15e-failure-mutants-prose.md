---
date: 2026-11-25
author: claude-agent
type: failure
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - test/e2e/tui.e2e.test.ts
  - packages/cli/src/tui/app.ts
  - packages/cli/src/tui/main.ts
supersedes: docs/log/2026-11-25-e8-15e-failure-mutants.md
---

**What.** Of the three guards the Serve quit smoke pins, it kills one mutant: q quitting inside pi-tui's input handler rather than on the next turn. Removing the redraw guard in App.redraw, or the error handler and try around the summary's write in main.ts, still passes.

**Why.** pi-tui 1.3.0 skips every render once stopped, and with q on the next turn the console is not closed under the summary, so neither guard is reached on this console.

**Result.** Each mutant was made by hand in its file and the Serve smoke run on it (test/e2e/tui.e2e.test.ts, the test named while Serve runs); the earlier entry cited a reviewer's script outside the repository (verification R-5).

**Consequence.** Both guards stay as a backstop.
