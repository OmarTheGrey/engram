---
date: 2026-11-25
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "make tui-screens"
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli/test/tui/screens.test.ts"
  - docs/design/screens/index.md
supersedes: none
---

**What.** `make tui-screens` drives the real engram TUI through its FakeTerminal and @xterm/headless at 120x36 and writes 28 screenshots to docs/design/screens/. Each is written as PNG, `.ansi` and `.html`, with an index.md naming the keys that reach each screen.

**Why.** The README rewrite needs screenshots that a command can reproduce, not hand-made captures.

**Result.** The screens are written from a workspace seeded from fixtures/workspaces/inspector in a temporary folder, with a fixed clock and counted ids, and the PNGs come from Chromium through the pinned playwright. No dependency was added. Fifteen screens are in dark; Home, Read and write deny are also in light, high contrast, ASCII and 80x24. Line mode is the sixteenth. screens.test.ts checks three `.ansi` files byte for byte, and checks that nothing outside the workspace is written; it passes.

**Consequence.** Any TUI change that moves Home, Read or write deny must regenerate the screenshots.
