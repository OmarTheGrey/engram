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
  - packages/cli/test/main.test.ts
supersedes: docs/log/2026-11-21-e8-15-decision-plain-cli.md
---

**What.** The plain CLI changes by HELP's first line naming `engram tui`, by the new commands' help lines, and by a second "did you mean" line on an unknown command or flag; it gains no colour.

**Why.** The earlier entry said only new commands' lines and the suggestion line change; the lead's call 2 of 2026-11-22 (item 62) adds the first line. Everything else stays byte for byte: a suggestion as a second stderr line leaves the first line, stdout and the exit code as they are.

**Result.** Sections 12.1 and 12.2 list exactly what is pinned and what changes.

**Consequence.** E8.15a updates the help snapshot by those lines only.
