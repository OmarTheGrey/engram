---
date: 2026-11-22
author: claude-agent
type: change
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/unit/oracle.test.ts
supersedes: docs/log/2026-11-22-d3-change-oracle-replay.md
---

**What.** The invariants' oracle judges replay admissions (`replayAdmits`), and invariant 2's promotion property presents a replay in one case in five, not one in six as the superseded entry said (review finding D3-15).

**Why.** The rate moved from one in six to one in five when the replay cases were made to reach the replay rules (`docs/log/2026-11-22-d3-change-invariant-lead-rule.md`).

**Result.** `replayAdmits` is pinned on fixed cases in `oracle.test.ts`, one per refusal (review finding D3-17). An always-true `replayAdmits` fails 25 of them: `make test-one T=packages/core/test/unit/oracle.test.ts`.

**Consequence.** The lead-owned files still need their second reviewer.
