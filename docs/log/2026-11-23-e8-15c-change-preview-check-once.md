---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/write.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: none
---

**What.** Write's preview cancels a pending pause when it checks, and sends a check only when its command line differs from the last one sent; the last is forgotten whenever the preview is cleared (a write, New write). The pause is timed through an injected scheduler, a real timer by default.

**Why.** The fix of failure-preview-double-check: the same input is checked once, in either racing order.

**Result.** Three flow tests drive the pause by hand: Check again before the pause ends, the pause then Check again with nothing changed, and Check again after a write, which checks again. Before the fix the first two saw 2 calls. All CLI, ui and view tests pass twice (counts in the report).

**Consequence.** Check again on an unchanged form says it checked already instead of sending.
