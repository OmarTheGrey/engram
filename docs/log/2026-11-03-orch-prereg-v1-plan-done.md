---
date: 2026-11-03
author: claude-orchestrator
type: milestone
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/prereg-v1-plan.md
  - docs/research/preregistration.md
  - docs/research/prereg-v1-decisions.md
  - research/results/MANIFEST.md
  - "make test-repro"
supersedes: none
---

**What.** The plan's four PRs are done: the plan (#24), the conditions and the poisoning arm's live path (#25), the analysis code and evidence (#26), and the v1 draft with its decision sheet and readiness record (#27).

**Why.** The lead asked for the pre-registration driven as far as it goes without a model key, in four PRs with proper logging.

**Result.** Every PR had an independent review and verified fix rounds; #27 had a review of part A, two parallel final verifiers, a third that found it ready, and a closing polish. Eight results reproduce under `make test-repro`. H1 runs offline end to end from cassettes; live, it is one run per arm and `make h1-table`.

**Consequence.** What remains needs people or a key (the plan's section 7): the lead's 20 decisions, the label audit, the tag and deposit, an OpenRouter key, the live runs and the UNREAD readings.
