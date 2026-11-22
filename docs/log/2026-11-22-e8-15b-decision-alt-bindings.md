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
  - packages/cli/test/tui/review.test.ts
supersedes: none
---

**What.** alt+c copies and alt+p opens the palette, each a second binding that works inside a text field; there, the hints name only alt+c, alt+p, ctrl+g and the field's own keys. The first loop says "alt+c copies it", and `v` or alt+v opens a loop step's full result.

**Why.** The lead's decision on review I7 and I9: in a field `c` and `;` type, and VS Code's terminal keeps ctrl+p.

**Result.** Under ConPTY, alt+c and alt+p arrived and acted in four environments (finding of this date).

**Consequence.** Every action keeps a binding with no Alt; alt+ is only ever a second binding.
