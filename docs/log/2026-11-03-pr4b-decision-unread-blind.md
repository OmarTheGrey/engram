---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
supersedes: none
---

**What.** The sheet recommends that the members read MEM-INV-Bench's UNREAD replies without seeing each session's condition (decision sheet item 14).

**Why.** Part A's fix scores UNREAD only after two members read it; the readings happen after the run, when the condition is known, and a reader who sees it could steer C4 minus C5.

**Result.** The readings file (`h1-readings/1`) names each session's condition, so someone who does not read must hide it from the readers and restore it; agreeing readers decide a session, disagreeing ones leave it excluded (`docs/log/2026-11-03-pr4a-r1-decision-readings.md`).

**Consequence.** If the lead declines, the readings are made with the condition visible and v1 says so.
