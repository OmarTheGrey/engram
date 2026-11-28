---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.12
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/consent.ts
supersedes: none
---

**What.** A Python edit wrote `\u3164` and `\p{...}` into consent.ts as a literal character and as `p{...}`, breaking the invisible-character pattern.

**Why.** Python read the escapes in a non-raw string.

**Result.** Caught by reading the line back before any test ran, and fixed by hand with the Edit tool.

**Consequence.** Edits with escapes go through the Edit tool.
