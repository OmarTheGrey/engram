---
date: 2026-11-28
author: claude-agent
type: decision
card: D4
chapter: design
pillar: distill
hypothesis: none
evidence:
  - docs/decisions/0011-one-lifecycle-replay-admission.md
  - docs/log/2026-11-28-e2-14-finding-drift-rule-for-d4.md
  - packages/core/src/distill/drift.ts
  - packages/core/test/unit/distill/drift.test.ts
supersedes: none
---

**What.** A re-validated procedure retires on ADR 0011's rule, its success rate below `replay-drift.success-floor` after `replay-drift.min-trials` trials, not on the card's "below the admission rule".

**Why.** ADR 0011 is accepted and every registered preset already sets both thresholds (strict 0.8, medium 0.7, permissive 0.6, 10 trials); the E2.14 schema comment points at them. The admission rule needs 4 of 5 tasks at 2/3, so one noisy task would retire a procedure; the minimum trials guard against that (Library Drift, SkillGuard).

**Result.** The rate is the re-validation's own mean reward with the procedure over all 15 trials, unsmoothed (no per-trial history in the log; a stored rate is a schema change). D3's k of n is reported in every reason and decides a restore. Written into ADR 0011 as a dated amendment.

**Consequence.** If the lead prefers the admission rule, `judgeDrift` changes one comparison and the amendment is rewritten.
