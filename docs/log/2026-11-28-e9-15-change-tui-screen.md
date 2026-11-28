---
date: 2026-11-28
author: claude-agent
type: change
card: E9.15
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/data.ts
  - packages/cli/test/tui/__frames__/surface-audit-verify-120x40-default.txt
  - make test-one T=packages/cli/test/tui/parity-surfaces.test.ts
supersedes: none
---

**What.** The TUI gains a Verify an audit report screen (the verdict, each check, the statement's counts) and two buttons on the log verify screen, Export an audit report (its generated form) and Verify an audit report.

**Why.** The lead wants every new command reachable from the TUI; Home at 120x40 is full, so the log verify screen carries them, and the palette lists both.

**Result.** Frames at 80x24 and 120x40 in four modes; the log verify frames move by the button line, the palette frames by the two new rows, each diff checked before `vitest -u`. parity-surfaces 24 passed, keys 22, frames-surfaces 128, frames 88, no-policy 8. Mutation check: renaming the verify button fails the reachability test; restored.

**Consequence.** None for other screens.
