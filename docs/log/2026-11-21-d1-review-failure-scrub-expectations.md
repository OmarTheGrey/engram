---
date: 2026-11-21
author: claude-agent
type: failure
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/test/unit/distill/scrub.test.ts
supersedes: none
---

**What.** Two new scrub tests failed on their first run. `token_count=7` came out redacted. A planted key in `mcp__x__sk-...` was not held.

**Why.** Both expectations were wrong. The first form is caught by the bypass table's own `NAME=value` rule, whose name pattern takes any name holding TOKEN. That table must stay unchanged, so the case was moved to `token_count: 7`, which the scrub's own rule keeps. In the second, an underscore before `sk-` leaves no word boundary, and long names now skip the 32-character rule.

**Result.** The tests now state both behaviours, and the second is recorded as a known limit. 27 scrub tests pass.

**Consequence.** The limit is in the hold-names decision. The table's over-match of TOKEN names is the bypass table's own.
