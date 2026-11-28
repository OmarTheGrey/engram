---
date: 2026-11-28
author: claude-agent
type: failure
card: E0.7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/core-determinism-rule.test.ts
supersedes: none
---

**What.** The independent review found that the rule's scanner read a `/` after a non-null assertion or a postfix `++` or `--` as the start of a regex, hiding a clock call on the rest of the line.

**Why.** `regexMayStart` treated `!`, `+` and `-` as operators whatever came before them; the bracket-balance check could not see it, since the hidden text had balanced brackets.

**Result.** The four probes the review gave failed before the fix and pass after it; `return !/x/` and `return ++x / 2` still lex correctly, since a keyword before `!` or `++` is not an operand. The current tree had no such line (the review's grep).

**Consequence.** A lexer edge is tested by a refused probe and a passing probe, each.
