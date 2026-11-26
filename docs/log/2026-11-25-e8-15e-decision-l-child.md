---
date: 2026-11-25
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/main.ts
  - test/e2e/tui.e2e.test.ts
  - packages/cli/test/tui/line.test.ts
supersedes: docs/log/2026-11-23-e8-15e-decision-l-child.md
---

**What.** On the real console, L starts engram tui --line as a child on the same terminal, with the workspace as it acts (a reviewer handoff's session values included) and an IPC channel. screen in that child hands its workspace and commands back over IPC and ends; the parent's full screen resumes. The full screen prints its commands before the child starts.

**Why.** In the same process, stdin read again after raw mode lost the first line on Windows. The review found that a child's own screen nested a grandchild on a second L, and that the handoff's actor was dropped (E-8, E-1).

**Result.** Smokes: L, screen, L leaves two node processes at most, one between; unit tests for the child's argv and the hand-back.

**Consequence.** None.
