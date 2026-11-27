---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/snippets.ts
  - docs/log/2026-11-22-e8-15d-finding-onfailure-block.md
supersedes: none
---

**What.** The hook entry the TUI writes carries `"onFailure": "block"`, and the screen says it takes effect from Claude Code v2.1.295 on.

**Why.** The whole design of 8.15 is set against a hook that fails open; the hooks reference now documents a field that makes a failed hook block the call, including one that cannot start. The coordinator allowed it only once verified there; it is (finding of the same day). The fixtures keep their shape: they are E8.4's tested harness, and this card does not change them.

**Result.** snippets.test.ts compares the entry with the fixture's plus that field; Try it is unchanged, since it judges the hook's own exit code and output.

**Consequence.** If a Claude Code older than v2.1.295 refuses a settings file with an unknown hook field, which its docs do not say, the person removes the line.
