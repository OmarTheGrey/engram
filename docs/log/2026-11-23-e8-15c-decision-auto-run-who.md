---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/who.ts
  - packages/cli/src/tui/screens/events.ts
supersedes: docs/log/2026-11-22-e8-15c-decision-auto-run.md
---

**What.** Events, Policy, the item page, Who can read and Supersede (given an item) run on opening; afterwards ctrl+s sends nothing until something changed (Who, Events, Policy) or does what the screen offers (Supersede's accept), and r runs again from the workspace as it is now.

**Why.** Review finding 9: Who sent a second request on ctrl+s after running on opening, which a harness counting requests saw as two.

**Result.** Flow test: one request on opening, none on ctrl+s, one more on r. Mutation: asking again fails it.

**Consequence.** Harnesses treat these screens as already run.
