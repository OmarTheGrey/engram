---
date: 2026-11-22
author: claude-agent
type: milestone
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/frames.test.ts
  - packages/cli/test/tui/__frames__/home-80x24-default.txt
  - packages/cli/test/tui/harness.ts
supersedes: none
---

**What.** The frame tests: nine screens at 80x24 and 120x40 in the default, `--no-color`, `--high-contrast` and `--ascii` modes, drawn by the real App through a FakeTerminal into `@xterm/headless`, against 76 committed snapshots of the text and every styled run.

**Why.** docs/design/tui.md 13 and card E8.15b's acceptance.

**Result.** `make test-one T=packages/cli/test/tui/frames.test.ts`: 79 passed, and passed again unchanged. No drawn line exceeds the width and each frame is exactly its height; colour sits on status symbols only; no colour in `--no-color` or high contrast; no Unicode drawing in `--ascii`; the palettes meet 4.5:1; 79x24, 80x23, 60x20 and 39x4 are the too-small screen. Mutation: colouring the status word too fails 12 tests. Every CLI test file: 449 passed after the P3-15 change.

**Consequence.** E8.15e's manual check renders what these frames pin.
