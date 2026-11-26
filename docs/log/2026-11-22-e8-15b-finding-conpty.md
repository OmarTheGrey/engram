---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15b
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/main.ts
  - node pty-tui.ts packages/cli/src/main.ts (scratchpad, ConPTY through @lydell/node-pty)
supersedes: none
---

**What.** `engram tui` run for real inside a Windows pseudoconsole (ConPTY, which conhost hosts) on this machine, driven by keys and resizes.

**Why.** The card asks for a real start, not only headless frames.

**Result.** Home drew; `?` opened and esc closed help; `;` and `prom` found Promote; `w`, typed content, ctrl+s showed the confirmation with the exact command; `y` ran the write (exit 0, the CLI's own text); 120x40, 60x20 (the too-small screen with the command) and back to 80x24 all redrew with the result kept; ctrl+c exited 0, left the alternate screen and printed the session summary. With no WT_SESSION the status symbols were ASCII (`+ exit 0`) and the box drawing Unicode, as 11.7 says for conhost.

**Consequence.** Glyph rendering in conhost's fonts is still for E8.15e's manual check.
