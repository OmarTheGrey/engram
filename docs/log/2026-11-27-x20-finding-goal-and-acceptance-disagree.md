---
date: 2026-11-27
author: claude-agent
type: finding
card: X20
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/X20.md
  - packages/runner/test/rv1.test.ts
  - docs/log/2026-11-27-x20-decision-plain-400-stays-a-stop.md
supersedes: none
---

**What.** Card X20 disagrees with itself on a plain 400. Its Goal names "a 400" as an exclusion. Its acceptance requires `rv1.test.ts` to pass unchanged, and that test expects a `400 Bad Request` to stop the run.

**Why.** The disagreement surfaced in the fix pass of 2026-11-27. The orchestrator settled it for X20 in favour of the acceptance, so a plain 400 stops.

**Result.** If a per-prompt 400 recurs on one item, an H1 run stops there at every resume. The runbook routes that case to the lead (`docs/tasks/prereg-v1-plan.md`, section 7).

**Consequence.** A card after H1's `MERGE=4`, when the runner may change again, decides whether a plain 400 becomes an exclusion. That card would also update RV1's two tests. A ready patch was drafted in the fix pass, but it is not on the branch.
