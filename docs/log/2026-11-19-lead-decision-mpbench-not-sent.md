---
date: 2026-11-19
author: omar
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/mpbench-request.md
  - docs/tasks/backlog.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** The lead decided not to send the MPBench request (`docs/research/mpbench-request.md`).

**Why.** Section 7's step 7 of `docs/tasks/prereg-v1-plan.md` left the request to the lead "if still wanted"; H1's poisoning arm runs on MEM-INV-Bench (ADR 0029, decision sheet item 15).

**Result.** Step 7 and the MPBench backlog row say so. MPBench stays a candidate in `packages/bench/PINS.md`, which may return by amendment before card X3 if it is released.

**Consequence.** No request is sent; card BF1 stays the fallback's fallback.
