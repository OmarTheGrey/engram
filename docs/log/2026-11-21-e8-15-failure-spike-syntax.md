---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.15
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "node --test headless.test.ts and node pty.ts direct|bash, in the session scratchpad's tui-spike folder (never committed)"
supersedes: none
---

**What.** The spike's first headless run failed to load: Node 24's type stripping refused a TypeScript class parameter property (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`).

**Why.** The repository runs TypeScript by type stripping (ADR 0019), which allows erasable syntax only; constructor parameter properties are not erasable.

**Result.** Rewritten with explicit fields; the tests then ran. A second failure followed: the 80x24 frame drew 23 rows (the layout subtracted three rows, not two) and box titles ended in `...`, because pi-tui's `truncateToWidth` appends an ellipsis unless its third argument is an empty string. Both fixed; 4 of 4 pass.

**Consequence.** ADR 0044 notes both, and the design requires every layout to render exactly the terminal's row count, checked by the frame snapshots.
