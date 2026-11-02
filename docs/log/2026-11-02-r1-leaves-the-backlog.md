---
date: 2026-11-02
author: omar
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** The lead took the pre-registration (card R1) off the backlog and asked for v1 to be driven as far as it goes without a model key, in four PRs.

**Why.** Gate C (13 December) needs the H1 table on the primary model, and nothing runs before `prereg-v1`; Gate B finished early, on 29 October, leaving the time to do it.

**Result.** The backlog row is removed; card R1 is open again, and the plan `docs/tasks/prereg-v1-plan.md` drafts v1. The GateMem deletion decision now falls due before the tag rather than before this step.

**Consequence.** The lead confirms v1's decisions, tags it and deposits it; live runs wait for the tag and a key.
