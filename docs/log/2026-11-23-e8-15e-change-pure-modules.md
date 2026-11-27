---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/words.ts
  - packages/cli/src/tui/asks.ts
  - packages/cli/src/tui/validate.ts
  - docs/deps.md
supersedes: none
---

**What.** The shell quoting, the quit summary, the confirmations of 9.5 and the CLI's argument checks moved out of argv.ts, app.ts and forms.ts into words.ts, asks.ts and validate.ts, which import no pi-tui; the old modules re-export them. @lydell/node-pty 1.1.0 became a root dev dependency with its docs/deps.md row.

**Why.** Line mode must reach the same commands in the same words without pi-tui (design 11.6), and the pseudoconsole smokes need a pty.

**Result.** Before and after, the 503 TUI tests passed unchanged; tsc and biome clean.

**Consequence.** Line mode and the full screen share one source for what is asked and how a command line is printed.
