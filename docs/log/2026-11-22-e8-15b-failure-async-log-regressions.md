---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/src/tui/fields.ts
  - packages/cli/test/tui/review.test.ts
supersedes: none
---

**What.** The reviewer's s7, rerun, found two regressions of the fix pass: a refused Postgres log no longer sent the start to first run, and a Postgres URL given on the command line showed its password in first run's field and command row (and the workspace panel's).

**Why.** With the log checked off the input path (I1) the start chose Home before the check answered; and the I4 redaction covered command lines built from argument vectors, not the panels' text rows or their fields.

**Result.** A refused answer for the start's check now opens first run at the log's question; a given secret URL is drawn redacted until retyped, a first keystroke starting it afresh, and the panels' rows are redacted while `c` copies them whole. Both have tests in review.test.ts (24 passed).

**Consequence.** None beyond the tests.
