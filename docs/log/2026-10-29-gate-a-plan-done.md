---
date: 2026-10-29
author: claude-orchestrator
type: milestone
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/gate-a-e0-e1-e2-plan.md
  - docs/log/2026-10-29-gate-a-milestone-corrected.md
  - "make test"
  - "make test-invariants"
  - "make test-e2e"
supersedes: none
---

**What.** The Gate A plan is done: E1.1 Postgres (#10), E0.4 doctor and layer 6 (#11), E2.4 retention (#12), E2.5 promotion (#13), the Gate A close-out (#15), and a hotfix (#14).

**Why.** Every remaining E0, E1 and E2 card and Gate A's open items, in at most six PRs.

**Result.** At main `af2c6ec`: `make test` 1809 passed, 14 skipped; 5 invariants; `make test-e2e` 10 passed on SQLite and embedded Postgres; CI and e2e green. Each PR was reviewed independently and its fixes verified before merge; reviews found 9 critical defects, all fixed (a half-commit on connection loss, password leaks, self-approval, grant-based promotion, read-grant laundering). The merge of PR 6 exposed that embedded-postgres's exit hook made failing core and cli tests exit 0 since #10; #14 fixed it and found no test had failed silently.

**Consequence.** Follow-ups: `docs/tasks/backlog.md`.
