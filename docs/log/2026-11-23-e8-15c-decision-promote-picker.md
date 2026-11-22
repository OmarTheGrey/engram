---
date: 2026-11-23
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

**What.** Promote has no item picker of its own: its item comes from `p` on Read, Events and the item page, or is typed; the field's hint shows the known item's class, scope and first line.

**Why.** 8.8 asks for a picker of the last read's items. A picker is a list control the frame does not have yet, and every path to Promote from an item already fills it.

**Result.** Review finding 10; the cheap ones were fixed (From file marks, later reads' note, the sync header's glyph, Follow while covered).

**Consequence.** A picker is left for E8.15e's controls.
