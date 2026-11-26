---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/write.ts
supersedes: none
---

**What.** Write's Content is a one-line text field; `ctrl+x ctrl+e` (the content in `$EDITOR`) and Policy's `o` (the policy file in `$EDITOR`) are not built in this part.

**Why.** pi-tui's Input is one line, and handing the terminal to an editor needs the TUI suspended and resumed, which the frame of E8.15b does not offer yet. A multi-line item is written with From file (`--file`), which the screen offers.

**Result.** Every write flag stays reachable; only the editing comfort is missing.

**Consequence.** Left for E8.15e, with the terminal work there; a decision to revisit if the lead wants it here.
