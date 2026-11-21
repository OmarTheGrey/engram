---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
supersedes: docs/log/2026-11-21-e1-4-decision-run-budget-and-tight-policy.md
---

**What.** The model draws every named item from the live projection when its command runs, adds Lee and his person scope, weights commands (one oneof inside fc.commands) and asserts floors of 20 allowed promotions, evictions, granted reads and grant changes per 200 runs, scaled with the run count.

**Why.** Review finding E1.4-2: 289 of 317 grant changes and 271 of 296 promotions named absent or unreadable items, and a retired-readable core mutation passed.

**Result.** Promotions name active person items of the promoter's scopes, in place for episodic, widened otherwise; a reopen that runs only after a crash replaces most plain reopens (157 of about 3,200 commands); new items take the clock as `valid_from`; the tight policy is drawn two runs in three. 3.2 s.

**Consequence.** If wrong, picking by index over live items shrinks less precisely; counterexamples seen shrink to two to seven commands.
