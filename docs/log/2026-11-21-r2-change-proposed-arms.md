---
date: 2026-11-21
author: claude-agent
type: change
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/tasks/R2.md
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** The section "Proposed amendments, not yet registered" of the pre-registration now holds twelve proposals: seven arms the absorb plan schedules (P1 red-team, P2 injection-screen floor, P3 NLI tier, P4 near-duplicate tier, P5 paired fault injection, P6 erasure residue, P7 trust-floor preset) and five that are not scheduled (U1 to U5).

**Why.** A number from an arm nobody wrote down before it ran is exploratory at best. Decision item 56 settled the form: one batch, and the lead registers each arm separately, by amendment.

**Result.** Each entry gives the hypothesis it serves, its design, metric and registered statistic, seed policy, stopping rule, cost and Holm effect. No registered line changed: its `git diff` shows additions only. `uv run pytest -q research/tests/test_prereg.py`: 10 passed.

**Consequence.** Cards X14, E2.10, L7, L5 and E2.11 have a text to point to. Each waits for the lead's registration before its run enters the thesis.
