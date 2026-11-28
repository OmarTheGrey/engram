---
date: 2026-11-28
author: claude-agent
type: change
card: E9.16
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - packages/core/src/audit/ropa.ts
  - packages/core/test/unit/subject-access.test.ts
  - packages/core/test/unit/audit/ropa.test.ts
  - packages/cli/test/subject-export.test.ts
  - packages/cli/src/tui/screens/data.ts
supersedes: none
---

**What.** After review: the subject report lists the scopes it read and accounts for the subject's own items in scopes not read, items granted to the subject elsewhere and the subject's own events the bundle does not carry; the person level is required; the notes say identity is the asserted --as and what a retire reason can name; the record lists consent opt-outs, approval routes and procedure options as measures when set; the TUI prefills the subject and log.

**Why.** Review findings 2 to 4, 7 and 8 of E9.16, and main's built consent and approval options (merged from origin/main).

**Result.** Core subject-access 9 of 9 and ropa 5 of 5; the acceptance 6 of 6, now counting the successor id's occurrences in the bundle (1). Disabling the grant rule fails the core test.

**Consequence.** C52's claim and limits and the README state the gaps.
