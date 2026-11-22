---
date: 2026-11-22
author: claude-agent
type: decision
card: L7
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/nli.ts
  - packages/core/src/lint.ts
supersedes: none
---

**What.** A flagged pair is a finding of lint `contradiction-nli`, tier `model`, on the later item, its event's policy id `<policy>/lint/contradiction-nli`, with no usage.

**Why.** The schema's tier enum has no NLI value and only card E2.8 changes the schema; the lint id says which rule decided.

**Result.** The id lives in a new `NLI_LINT_IDS` list inside `LINT_IDS`, beside L5's `near-duplicate-tier`; the scorers score it as the contradiction lint's. `planModelLints` still counts the model tier's calls, an upper bound for a tiered run.

**Consequence.** A later schema card may add a tier value. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
