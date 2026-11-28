---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.14
chapter: design
pillar: distill
hypothesis: none
evidence:
  - docs/decisions/0011-one-lifecycle-replay-admission.md
  - docs/tasks/D4.md
  - packages/core/policies/medium.yaml
  - packages/core/src/lint.ts
supersedes: none
---

**What.** Two rules for retiring a drifted procedure compete, and D4 must settle which applies. ADR 0011 retires an active procedure on a smoothed success rate below threshold, which every registered preset sets as `lints.thresholds` `replay-drift.success-floor` and `replay-drift.min-trials` (medium: 0.7 and 10). D4's card retires it when re-validation falls below the admission rule (D3's 4 of 5).

**Why.** `procedures.drift` says only when re-validation runs (an environment change, a period); the retirement threshold is deliberately not a field of it, so no second schema pull request is needed either way.

**Result.** The option's comment in `packages/core/src/schema.ts` now points at ADR 0011's rule and the two threshold keys. ADR 0011 also says a changed environment hash retires outright, where D4 re-validates, and it leaves the smoothed rate on items to a later schema change.

**Consequence.** D4 records its choice in a decision entry, or amends ADR 0011.
