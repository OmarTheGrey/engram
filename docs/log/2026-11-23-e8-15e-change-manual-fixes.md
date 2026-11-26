---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/src/tui/theme.ts
  - packages/cli/test/tui/access.test.ts
  - docs/design/tui-manual-check.md
supersedes: none
---

**What.** Two fixes the manual check found: the title bar now drops a long log path, then the connection, before it drops the actor; and any TERM_PROGRAM (mintty, WezTerm) means a terminal that is not conhost, so mintty gets the Unicode status symbols.

**Why.** In conhost a scratch log's path hid whom the TUI acts as; in Git Bash's mintty the symbols were ASCII though mintty renders them all.

**Result.** access.test.ts holds both: the actor stays at 120 and at 80 columns with a long path, and the ASCII detection table has rows for mintty and WezTerm. Rechecked by hand in conhost and mintty.

**Consequence.** Design 11.7 amended to the new rule.
