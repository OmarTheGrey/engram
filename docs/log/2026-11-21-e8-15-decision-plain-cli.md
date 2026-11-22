---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - packages/cli/test/main.test.ts
supersedes: none
---

**What.** The plain CLI changes only by new commands' help lines and a second "did you mean" line on an unknown command or flag; it gains no colour.

**Why.** Tests and scripts pin every output and exit code. A suggestion as a second stderr line leaves the first line, stdout and the exit code exactly as they are; colour on a TTY would change screen-reader transcripts and every pinned byte for no gain the TUI does not already give.

**Result.** Section 12: what is pinned, what changes, what deliberately does not (`<command> --help` and `engram help <command>` keep printing the whole help).

**Consequence.** Nothing existing breaks; E8.15a adds the suggestion function the palette also uses.
