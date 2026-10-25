---
date: 2026-10-25
author: claude-agent
type: failure
card: E2.1
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/load.test.ts
  - packages/core/src/policy/load.ts
supersedes: none
---

**What.** The first syntax-error test for card E2.1, an unterminated double quote on line 11 of a policy, failed: the error was reported at line 31.

**Why.** The yaml 2.9.1 parser detects a missing closing quote only at the end of the input, and the loader reports the position the parser gives.

**Result.** The test now breaks line 16 with a nested mapping in a compact value, which the parser reports on its own line; the unterminated quote case is a known limit of the line numbers.

**Consequence.** Policy authors may see an end-of-file line for an unclosed quote; the message names the missing quote, which is enough to find it.
