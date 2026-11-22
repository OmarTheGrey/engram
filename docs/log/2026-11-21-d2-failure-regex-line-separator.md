---
date: 2026-11-21
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/skill.ts
supersedes: none
---

**What.** The first `skill.ts` failed to load, with "Unterminated regular expression".

**Why.** Escapes for U+2028 and similar characters were written into a regex literal as the raw characters, and a raw U+2028 ends a line.

**Result.** The regex was replaced with a code-point predicate (`printable`). The file is ASCII.

**Consequence.** None.
