---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui-manual-check.md
  - docs/design/tui.md
  - packages/cli/src/tui/theme.ts
supersedes: none
---

**What.** conhost keeps its ASCII status symbols by default; its box drawing stays Unicode.

**Why.** Design 11.7 asked the manual check to decide whether the default could go. In a real Windows 11 conhost window the box drawing and the status symbols but one render; ℹ is drawn wider than its cell and overlaps the next. Windows 10's console renderer, which has no font fallback, is not on this machine.

**Result.** With the Unicode set forced (WT_SESSION set by hand) the doctor screen's symbols read well; ℹ is the one fault. --ascii, ENGRAM_TUI_ASCII and the unchanged default are unaffected.

**Consequence.** Revisit on a Windows 10 console, or with ℹ replaced in the Unicode set.
