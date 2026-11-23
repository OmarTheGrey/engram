---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/surface.ts
  - packages/cli/src/tui/screens/data.ts
  - packages/cli/src/tui/screens/setup.ts
  - packages/cli/test/tui/no-policy.test.ts
  - docs/design/tui.md
supersedes: none
---

**What.** `origin/cliupgrade` at 05f99524 merged into `cliupgrade-d` again, with E8.15c's verification fixes, and E8.15d's screens fitted to them.

**Why.** The coordinator's instruction once E8.15c's fixes landed.

**Result.** `r` on E8.15d's screens is E8.15c's `rerunArgv`, the one implementation: the command line that ran, its actor flags (now `--owner` too) the workspace's only for another actor's answer; my own helper is gone. Import compares the import actor of the actor now by E8.15c's key (id, level, sorted memberships). The type-checked guard flagged three `JSON.stringify` calls: two on the snippets the screen builds, now typed as such and passing, and one in my J view, which now shows E8.15c's `other`, the command's own `--json` print; no exemption marker is used. My ASCII frames moved by the closed fold only (`+` to `~`, 18 lines); tui.md 11.7 says `~` and cites E8.15c's glyph entry.

**Consequence.** Nothing further on this branch.
