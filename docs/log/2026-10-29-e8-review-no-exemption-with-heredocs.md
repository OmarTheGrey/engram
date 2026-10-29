---
date: 2026-10-29
author: claude-agent
type: change
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass.test.ts
supersedes: none
---

**What.** Finding R3-27: a command containing any heredoc (`<<` other than `<<<`), whatever its delimiter, grants no commit-message exemption.

**Why.** A delimiter-based rule missed `<<!`, `<<.` and `<<$X`.

**Result.** The three probes with a `$(cd memory; cat a.md)` message are blocked tests, and so is a quoted `<<'EOF'` body (the cost); `git commit -m 'fix memory leak'` passes. Restoring the delimiter rule fails 4 tests; dropping the heredoc rule fails 7.

**Consequence.** ADR 0014's amendment states the rule.
