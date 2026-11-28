---
date: 2026-11-28
author: claude-agent
type: change
card: L9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/frames-surfaces.test.ts
  - packages/cli/test/tui/__frames__/surface-lint-grounded-80x24-default.txt
  - packages/cli/src/commands.ts
  - packages/cli/src/tui/screens/policy.ts
supersedes: none
---

**What.** The TUI lint screen's frames gain `lint-grounded`: a grounded model finding with its evidence opened, at 80x24 and 120x40 in the four modes, showing both `quote of <id>` lines.

**Why.** The addendum: `engram lint` shows the quotes when the option is on.

**Result.** No source change was needed. The quotes are evidence lines, so `engram lint` prints them inside each lint event's reason (`eventLine`), `--json` carries them in `findings[].evidence`, and the lint screen lists them under "evidence" with space. The frames file passes with the 8 new snapshots written on purpose; the existing lint frames are unchanged. No registry, route, MCP or pi change: the option is a policy key, not a command.

**Consequence.** See the finding on surfaces without a lint model.
