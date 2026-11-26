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
  - "node <scratchpad>/rev-e/mutate.mjs, or by hand: replace setImmediate(() => this.quit()) by this.quit() in app.ts dispatch, or delete if (this.stopped) return; in redraw, or the error handler and try around io.out in main.ts print, then ENGRAM_OFFLINE=1 ENGRAM_PG=skip pnpm exec vitest run --config test/e2e/vitest.config.ts test/e2e/tui.e2e.test.ts -t 'while Serve runs'"
supersedes: docs/log/2026-11-23-e8-15e-failure-mutants.md
---

**What.** Of the three guards the Serve quit smoke pins, it kills one mutant: q quitting inside pi-tui's input handler. Removing the redraw guard, or the guard on the summary's write, still passes.

**Why.** pi-tui 1.3.0 skips every render once stopped, and with q on setImmediate the console is no longer closed under the summary, so neither guard is reached on this console.

**Result.** Both kept as a backstop, which docs/design/tui-manual-check.md says. The evidence command names each mutant and the run; the earlier entry promised it and gave none (review E-7).

**Consequence.** A pi-tui that renders after stop would make the redraw guard observable again.
