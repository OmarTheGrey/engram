---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/runner.ts
supersedes: none
---

**What.** A TUI action runs `run(argv, io)` itself, with output captured and the transport teed, rather than calling each command's prepare and call parts.

**Why.** docs/design/tui.md 6.2 names the split; running `run` gives the same handler, parse, connect, client call, `drainExports` and bytes with no second path to keep in step, and the tee still hands a screen the typed answer (the first loop's read id).

**Result.** Parity holds by construction; forms still use the parts (parse and prepare) to validate without calling.

**Consequence.** If wrong, E8.15c's rich screens may call the parts instead; nothing in E8.15b depends on the choice beyond runner.ts.
