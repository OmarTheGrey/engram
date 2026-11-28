---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.16
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/parity.test.ts
  - packages/cli/test/tui/parity.test.ts
supersedes: none
---

**What.** The TUI is probed as its own surface through its runner (`runCommand`, which runs the same argv through the CLI's `run`), and its drawn screen and JSON view after a read are scanned page by page for each probe actor and the control.

**Why.** packages/cli/test/tui/parity.test.ts already shows each TUI action is its plain argv; the screen scan adds what only the TUI draws.

**Result.** 581 TUI probes, no leak; the control's drawn JSON view carries team canaries.

**Consequence.** Driving every probe by keys would cost minutes for no new path.
