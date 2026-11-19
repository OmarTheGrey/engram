---
date: 2026-11-19
author: omar
type: decision
card: none
chapter: design
pillar: govern
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - docs/log/2026-11-13-e9-1-review-fixes.md
supersedes: none
---

**What.** The lead confirmed that the knowledge and twin profiles differ on purpose in the sources their team rule admits: tool and import sources in the knowledge profile, only user and document in the twin profile.

**Why.** The review of card E9.1 left the difference for the lead to confirm (backlog row "Knowledge and twin team sources").

**Result.** The row's part for the lead is closed in `docs/tasks/backlog.md`; neither profile changes.

**Consequence.** The row's other half stays open: a shared load helper for both profile tests and a test that every `profiles/` file parses.
