---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/line.ts
  - packages/cli/test/tui/line.test.ts
  - docs/design/tui.md
supersedes: none
---

**What.** In line mode check is an ordinary command, and also write's preview; only mcp and hook are setup only.

**Why.** The card's list reads "check, mcp and hook as setup only". Design 8.31, which the card builds from, lists 3 check in the menu, previews a write with engram check, and calls only mcp and hook setup only, since those two read the terminal. check writes nothing and reads no stdin; making it setup only would drop a plain command from line mode against 11.6.

**Result.** The preview prints check's own output, drawing its ids apart from the session's, so the write after it prints byte for byte what the plain write prints (line.test.ts).

**Consequence.** If the card meant otherwise, check's menu entry is the one place to change.
