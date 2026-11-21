---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - packages/core/test/unit/policy/injection-screen.test.ts
supersedes: none
---

**What.** The first test run failed to parse `injection-screen.ts`: the file-writing tool had turned some `\uXXXX` escapes into the characters themselves, and a literal U+2028 inside a regular expression ended it.

**Why.** Invisible characters in a rule table must stay escaped to be reviewable and to parse.

**Result.** A script rewrote every format, space and control character in both files as an escape (25 in the source, 11 in the test); the suite then ran.

**Consequence.** New rule tables are checked for raw non-ASCII format characters before a run.
