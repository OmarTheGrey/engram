---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/src/tui/keys.ts
  - packages/cli/src/tui/overlays.ts
  - packages/cli/src/tui/forms.ts
  - packages/cli/src/tui/screens/home.ts
supersedes: none
---

**What.** The TUI's frame on pi-tui's TuiAltScreen: the router and its frame (title bar, screen, command line row, key hints), the key table on pi-tui's KeybindingsManager, the help overlay, the palette, the confirmation, a generated form and result for every registry command, and the screens Home, first run, the guided first loop, Workspace and too small.

**Why.** Card E8.15b, docs/design/tui.md 4, 6, 7, 8.1 to 8.4, 9 and 10.

**Result.** Every action is its plain command's argument vector, shown in the command row before it runs and run through `run`; forms validate with the command's own parse and prepare; confirmation follows each entry's `writes`, a read with a store folder once a session. `make test-one T=packages/cli/test/tui/keys.test.ts`: 21 passed.

**Consequence.** E8.15c and E8.15d add rich screens over the same entries; the generated form stays the fallback.
