---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/loop.ts
  - packages/cli/src/tui/keys.ts
supersedes: none
---

**What.** In the guided first loop each step's own text is its confirmation (one press of enter runs it), and skip has ctrl+n as a second key beside `s`.

**Why.** 8.2 asks for one press per step; the write and read steps hold a focused text field, where `s` types.

**Result.** keys.test.ts runs write, read and explain, the explain on the read's own id.

**Consequence.** If wrong, the loop gains the 8.29 dialog before its write.
