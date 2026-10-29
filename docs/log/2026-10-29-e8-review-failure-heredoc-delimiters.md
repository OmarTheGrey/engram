---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass.test.ts
supersedes: none
---

**What.** The R3-26 heredoc rule recognised only delimiters starting with a letter, a digit or `_`, so `<<!`, `<<.` and `<<$X` heredoc bodies kept the message exemption and, as a real bash run confirmed, read the store (finding R3-27).

**Why.** The rule tried to tell expanding delimiters from quoted ones by their first character, which misses delimiters bash accepts.

**Result.** Replaced by the simplest safe rule: no exemption in any command containing `<<` other than `<<<`.

**Consequence.** Where a safe rule and a precise rule differ, take the safe one.
