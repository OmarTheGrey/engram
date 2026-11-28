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

**Result.** Caught by reading the line back before any test ran. The Edit tool then wrote the two Hangul fillers as raw characters, not escapes, which the review found; they are now removed, since `\p{Default_Ignorable_Code_Point}` covers both (a unit test checks U+3164 and U+115F inside a word).

**Consequence.** Edits with escapes go through the Edit tool.
