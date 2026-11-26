---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/overlays.ts
  - packages/cli/src/tui/screens/rich.ts
supersedes: none
---

**What.** The real TUI under ConPTY (the spike's node-pty driver, a scratch `--db` and `--root`, `--no-saved`) over Read, the plain and JSON views, Explain, the item page, Write's denied preview and result, Promote with the handoff and Switch back, Grants add and undo, Events with follow, Policy with find, Who can read and Supersede, and the ascii, no-color and high-contrast modes.

**Why.** Card E8.15c's last check, with absolute scratch paths, which the tests' relative ones do not exercise.

**Result.** Every screen worked. Three defects showed and were fixed with a test each: a confirmation under a long command lost its buttons, a long word in an output line was split by a space, an event's reason was cut. `--ascii` wrote no non-ASCII byte, `--no-color` no colour SGR, high contrast bold only.

**Consequence.** None beyond the fixes.
