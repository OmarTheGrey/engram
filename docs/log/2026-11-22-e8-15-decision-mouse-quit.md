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
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** The mouse is captured by default with `--no-mouse` to turn it off, and every quit prints the session's commands as a short list unless `--quiet`.

**Why.** Decided on 2026-11-22 under the lead's delegation (item 62, calls 5 and 6). Clicks and the wheel help most people, and the help overlay says Shift+drag selects text; the waiver keeps terminal selection and accessibility tools. The list on quit teaches the CLI, which is the TUI's purpose.

**Result.** Sections 4.1, 5.1 and 11.1 of the design.

**Consequence.** E8.15b implements both; `ENGRAM_TUI_MOUSE=0` and the saved workspace carry the mouse choice.
