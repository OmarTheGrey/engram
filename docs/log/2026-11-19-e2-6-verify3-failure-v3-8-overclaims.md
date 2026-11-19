---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** Finding V3-8: the offboarding header said a record written after the report is the person's, and ADR 0010 said the hard deletion is complete once the report is appended.

**Why.** Both were true only for ids, not for content under fresh ids.

**Result.** Both texts are corrected, and the remaining policy questions are in ADR 0010.

**Consequence.** None.
