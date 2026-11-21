---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.10
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/simulate.ts
  - packages/core/test/unit/policy/injection-screen.test.ts
supersedes: none
---

**What.** The simulator's `changed` list and its totals do not show a write the screen holds: a hold is an allow under both policies, so only the reads after it differ.

**Why.** Found writing the simulator test, which first expected the two held writes among the changed steps.

**Result.** On the E2.10 workload, `changed` lists steps 5 and 6 (the reads), not 1 and 2 (the held writes); each held write's own outcome differs only in its reason and policy id.

**Consequence.** A status column (active or candidate) in `StepOutcome`, or counting a status change as a change, would show holds directly; it is a schema change for card E8.9's report, left to the lead.
