---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/src/tui/main.ts
  - "node rv-drive-r.ts e4.json (the reviewer's ConPTY driver; start Serve, esc, q)"
supersedes: none
---

**What.** Quitting with `q` while a server ran ended the TUI with exit 1 and no summary: `write EPIPE` at the summary's write, uncaught.

**Why.** `q` quit inside pi-tui's handling of the key, while ctrl+c already quit on the next turn (E8.15b's failure-ctrl-c-in-handler). With a server to stop first, the console was given back under pi-tui's input handling and the summary's write failed. Guarding redraw after the stop alone did not help (still exit 1); esc then ctrl+c gave exit 0, which isolated the key path.

**Result.** `q` now quits on the next turn too, and the summary write is guarded. Under ConPTY: exit 0, no uncaught error, "stopped when the TUI quit" printed.

**Consequence.** Every quit path goes through the same turn.
