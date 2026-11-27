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
  - packages/cli/src/tui/line.ts
  - test/e2e/tui.e2e.test.ts
  - packages/cli/test/tui/line.test.ts
supersedes: docs/log/2026-11-25-e8-15e-decision-l-child.md
---

**What.** On the real console, L starts engram tui --line as a child on the same terminal with the workspace's own flags; a reviewer handoff rides apart, in the child's environment beside a random token, and is set there for this session only. screen in the child hands back its flags, the handoff and its commands over IPC, and the parent's full screen takes the handoff up again.

**Why.** A handoff passed as flags became given and was saved to tui.json (verification R-1), breaking design 8.8. The token keeps an unrelated IPC parent from receiving a hand-back (R-3).

**Result.** Tests: tui.json holds no reviewer after a save in line mode; the full screen after screen shows the reviewer mark and Switch back restores the author.

**Consequence.** None.
