---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/review.test.ts
  - packages/cli/src/tui/app.ts
  - packages/cli/src/tui/log-check.ts
supersedes: none
---

**What.** The review fix pass: 1 critical, 10 important and 15 minor findings closed, and the four UX items. The fixes: a read's dialog keyed on its own command line (C1); a Postgres log checked in a child process (I1); output with control characters stripped (I2); free pgup and pgdn (I3); redacted command lines (I4); no Postgres log saved (I5); a high-contrast denial frame (I6); alt+c and alt+p (I7, I9); wheel and click (I8); the loop's whole output (I10); and every minor.

**Why.** The reviewer's notes, driven in a real pseudoconsole, and the lead's decisions on I5, I7 to I9 and M11.

**Result.** `make test-one T=packages/cli/test/tui/review.test.ts`: 24 passed, each first seen failing. entry 18, keys 21, saved 11, frames 88 (84 snapshots). The reviewer's mutation (high-contrast deny as reverse video) now fails 3 frame tests.

**Consequence.** The reviewer's scripts are rerun over the fixed branch (finding entry of this date).
