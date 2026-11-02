---
date: 2026-11-02
author: claude-orchestrator
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/prereg-v1-plan.md
  - packages/runner/src/config.ts
supersedes: none
---

**What.** The orchestrating session planned v1 in four PRs and took eleven decisions (`docs/tasks/prereg-v1-plan.md`, section 3).

**Why.** v1 had five open questions (models, the poisoning arm's metric, GateMem forgetting, thresholds, H4's sample size), and H1 lacked condition C4, the poisoning arm's live path and any analysis code.

**Result.** Main ones: v1 is drafted, not tagged, with a decision sheet for the lead; a seeded power calculation replaces H4's pilot; C4 and C1 are ported from GateMem at its pin (ADR 0031, proposed); MEM-INV-Bench is registered where MPBench stood; `make test-repro` becomes real; step 10 of the lead's delegation list moves into PR 2.

**Consequence.** PRs 2 and 3 run in parallel after this one; PR 4 drafts v1 from their results.
