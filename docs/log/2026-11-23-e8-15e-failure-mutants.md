---
date: 2026-11-23
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
supersedes: none
---

**What.** Of the three guards the Serve quit smoke pins, it kills one mutant: q quitting inside pi-tui's input handler. Removing the redraw guard, or the guard on the summary's write, still passes.

**Why.** pi-tui 1.3.0 skips every render once stopped (its scheduleRender and the alternate screen's render check stopped), and with q on setImmediate the console is no longer closed under the summary, so neither guard is reached on this console.

**Result.** Kept both as defence in depth; a run of each mutant against the smoke is in the evidence command.

**Consequence.** A pi-tui that renders after stop would make the redraw guard observable again.
