---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0048-local-nli-tier.md
  - docs/tasks/lead-decisions.md
  - packages/core/src/lint/nli.ts
  - packages/core/test/unit/lint/nli.test.ts
  - research/results/h3-lint-nli.json
supersedes: none
---

**What.** ADR 0048 (the contradiction lint's local NLI tier) is accepted by the lead, item 66 (a), as written: both directions; on card L4's fixture the flag band is empty and the tier only drops.

**Why.** The lead wrote "accept the adrs" on 2026-11-25: his own answer, not one under the delegation, option (a) of each item.

**Result.** The decision text matches option (a): `packages/core/src/lint/nli.ts` scores each pair both ways and keeps the larger, tested by "scores every pair forward then backward" and "a backward score above the forward one decides the band" in `packages/core/test/unit/lint/nli.test.ts`; no registered preset enables it. Two sentences that left item 66 open were amended minimally, in the alternatives and the consequences, to record the answer.

**Consequence.** Item 66 is closed. Arm P3 stays proposed in the pre-registration; nothing registered moves.
