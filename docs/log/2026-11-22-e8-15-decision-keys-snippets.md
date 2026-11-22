---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - fixtures/harness/claude-code/.claude/settings.json
supersedes: none
---

**What.** The palette is `;` (and ctrl+p where it reaches the TUI), help is `?` (ctrl+g in a field), supersede is `S`, and Home has six groups on 1 to 6; the hook and MCP snippets take the tested fixtures' shape, and Try it spawns the exact copied command on a scratch `:memory:` log.

**Why.** Review findings E8.15-2, -3 and -8: VS Code keeps ctrl+p and F1, `:` is in every scope id, `u` meant two things, Try it wrote fake bypass events into the real log, and a pasted hook whose command did not resolve would fail open.

**Result.** Sections 8.1, 8.14, 8.15, 9.1 and 11.7, with key, snippet and log-count tests.

**Consequence.** E8.15b and E8.15d implement them.
