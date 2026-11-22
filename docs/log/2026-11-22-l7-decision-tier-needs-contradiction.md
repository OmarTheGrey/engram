---
date: 2026-11-22
author: claude-agent
type: decision
card: L7
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/plane/lint.ts
  - packages/core/test/unit/lint/nli.test.ts
  - docs/decisions/0048-local-nli-tier.md
supersedes: none
---

**What.** The NLI tier runs only when a policy enables `contradiction` as well as `contradiction-nli`; with no lint model its band pairs are not judged.

**Why.** Review L7-6, the lead's decision: the tier is part of the contradiction lint, as ADR 0048 says.

**Result.** Before, the id alone ran the tier. Now the id without `contradiction` runs nothing (a new core test). With both ids and no lint model, a band pair is neither a finding nor a call and appears only in the report's `nli` judgments with band `model`. Both fixture configs enable `contradiction`, so their replays and the result are unchanged.

**Consequence.** ADR 0048 states both. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
