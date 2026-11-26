---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/keys.ts
supersedes: none
---

**What.** E8.15b animates nothing (a call shows `working` in the command row, statically), and the key table is held by pi-tui's KeybindingsManager with no `~/.engram/tui-keys.json` rebinding yet.

**Why.** Calm by default (4.4) costs nothing without a spinner, so `--reduced-motion` already holds; rebinding is not in E8.15b's card list and its validation belongs with E8.15e's accessibility work.

**Result.** `--reduced-motion` is parsed, saved and has nothing to turn off.

**Consequence.** E8.15e adds the Loader and the rebinding file.
