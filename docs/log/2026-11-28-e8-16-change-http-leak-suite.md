---
date: 2026-11-28
author: claude-agent
type: change
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage-kit.ts
  - packages/server/test/leakage.test.ts
  - docs/absorbed.md
  - NOTICE
supersedes: none
---

**What.** The canary workspace (thirteen seeded nonces through seven write paths, from a denied write to an offboarding's erasure) and the HTTP API's leak suite, probing every route as a non-member, an expired grantee, a former member and a partial grantee.

**Why.** Card E8.16, steps 1, 2 and 4: the thesis says every read is filtered, and a zero-leak count over every route is the figure that shows it. Structure ported from ClickHouse/loom (Apache-2.0, `61b22646a1af`).

**Result.** `make test-one T=packages/server/test/leakage.test.ts`: 11 passed. 728 probes, no canary leaked; no answer outside a route's declared statuses; the positive control (a team member) finds the team's three canaries. A route with no probe and no exemption fails `coverage`; the one exemption (distill, 501) is checked to still answer 501.

**Consequence.** A new route needs a probe line or an exemption with a reason that is checked.
