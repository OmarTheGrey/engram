---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/faults/generate.ts
  - packages/bench/scripts/fault-set-check.ts
  - fixtures/fault-sets/longmemeval/policy.json
  - "make test-one T=packages/bench/test/faults/fixture.test.ts"
supersedes: none
---

**What.** Card L2's fault set enabled `[...LINT_IDS]`; it now enables `FAULT_SET_LINT_IDS`, the eight ids the plane had when the set was registered, exported from `generate.ts` and used by `fault-set-check.ts`.

**Why.** Adding `injection-signature` to `DETERMINISTIC_LINT_IDS` would have changed the registered set's policy, its committed `policy.json` and what H3's lint floor runs, which the pre-registration guard forbids. The card keeps to core, but this one-line freeze in packages/bench is the only way to add the id and move nothing.

**Result.** The bench fault tests pass with `policy.json` unchanged.

**Consequence.** A later lint joins the set only by a change to this list, which is a change to the registered set.
