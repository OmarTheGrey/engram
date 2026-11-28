---
date: 2026-11-28
author: claude-agent
type: change
card: E2.21
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/src/policy/grants.ts
  - packages/core/src/policy/options.ts
  - packages/core/test/unit/plane/write-grants.test.ts
  - make test-one T=packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** Part 2 builds ADR 0034's cap and first-write rule behind `grants.expiry_cap`, and lifts its row from `notBuiltOptions`.

**Why.** Decisions 3 and 6 are accepted; the lead's answer keeps them opt-in until the thesis runs are done.

**Result.** With the option on, `grantDefect` refuses an expiry more than 31,536,000 seconds after the event's own time under `engram/write/grant-expiry-cap`, never clamped; the reason names the grant's expiry and the limit. It judges every grant of a first write (the whole of `grantDefect`: an expired grant or one of another class too), every grant a rewrite adds, and every `Plane.changeGrants` addition; kept grants are not judged again; promotions are exempt. Absent or `off`, the gate decides exactly as before. `write-grants.test.ts`: 40 passed, 13 new; five mutants killed.

**Consequence.** Only policies that set the option hold the rule.
