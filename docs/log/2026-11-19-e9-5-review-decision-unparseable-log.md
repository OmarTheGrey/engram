---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/scripts/dogfood-report.ts
  - packages/core/src/dogfood.ts
supersedes: none
---

**What.** A log with any event that does not parse gets no report: the script names each such event by seq and exits 2.

**Why.** Counting the rest would give numbers from a log that is not what the plane wrote; a damaged row is for the member to look at.

**Result.** Tested on three kinds of damage.

**Consequence.** A member whose log does not parse tells the team the seqs, never the rows.
