---
date: 2026-11-28
author: claude-agent
type: failure
card: E0.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/core-determinism-rule.test.ts
  - Makefile
supersedes: none
---

**What.** `tsc -p tsconfig.json` (the second step of `make lint`) failed twice with TS2532 on the scanner's `templates[templates.length - 1]++` and `--`.

**Why.** `noUncheckedIndexedAccess` types an array element as possibly undefined, and vitest does not type-check.

**Result.** Both now read the element with `?? 0` before writing it back; tsc exits 0 and the rule's 37 tests still pass.

**Consequence.** Run `make lint` before the first commit of a new test file, not after.
