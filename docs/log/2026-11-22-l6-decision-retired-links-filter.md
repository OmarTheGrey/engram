---
date: 2026-11-22
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/supersede.test.ts
supersedes: docs/log/2026-11-21-l6-decision-retired-links.md
---

**What.** A retired version is no chain link, and asked about it is an unknown id. The read filter now gives this, not a separate status test.

**Why.** The earlier entry cited a test of `proposeSupersession` for a rule of `planSupersession` that no test covered (L6-2), and a mutant of that rule survived.

**Result.** The plane test 'a retired successor is no link' passes. Admitting retired items into the filter fails it.

**Consequence.** None.
