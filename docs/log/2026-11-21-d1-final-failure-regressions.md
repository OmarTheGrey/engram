---
date: 2026-11-21
author: claude-agent
type: failure
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/scrub.ts
  - packages/core/test/unit/distill/scrub.test.ts
supersedes: none
---

**What.** The first verification pass introduced two regressions, which the second verification found. The spaced name check held MCP tool names such as `mcp__firebase-auth__list_users` (W-2). The MySQL `-p` rule took 14 seconds on a 528 KB line (W-3).

**Why.** The spaced form fed every rule, the flag rule among them, where only the key-shaped rules were meant. The MySQL rule's lazy scan restarted at every `mysql` in the text, which is quadratic. Neither had a test: no tool name with a secret word in it, and no long input for that rule.

**Result.** Both are fixed and tested. Five tool names are not held, and 30,000 repetitions finish under a second. Restoring either old form fails its tests.

**Consequence.** A new scrub rule comes with an over-match test and a linear-time test.
