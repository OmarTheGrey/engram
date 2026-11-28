---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/runner/src/lint-fault-set.ts
supersedes: none
---

**What.** Two readers of a policy do not pass through the loader's refusal: `exportCedar` (`policy/cedar.ts`) refuses a policy with a content guard or trust option on, but knows nothing of the new options, and the fault set's `readSetPolicy` parses with `Policy.parse` alone.

**Why.** The refusal lives in `parsePolicy`; a policy object built in code, or a fault set's `policy.json`, reaches both readers without it.

**Result.** Harmless today: no committed policy or fault set sets an option, and no code reads one.

**Consequence.** A card whose option changes a write decision (E9.12's consent, E2.21's cap, E2.19's routing) should extend `exportCedar`'s refusal list in the same pull request, or the Cedar export would disagree with the evaluator.
