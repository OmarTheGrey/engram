---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.10
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/cli/test/doctor-discover.test.ts
supersedes: none
---

**What.** No proof-of-concept result file: the fake home's counts stay a test.

**Why.** The counts on a fixture home measure the fixture, not the system; the measurement Gate D wants is a member's own machine, which is dogfood and under rule 12 only its aggregate counts may be committed, through the dogfood report.

**Result.** No MANIFEST row, no register section.

**Consequence.** If wrong: the lead wants a register row for the fixture counts. Cost: one small script and config.
