---
date: 2026-11-20
author: claude-agent
type: finding
card: RV8
chapter: design
pillar: research
hypothesis: H2
evidence:
  - docs/research/preregistration.md
  - research/configs/label-audit-longmemeval.json
supersedes: none
---

**What.** The pre-registration registers 50 audited items per benchmark but no sampling rule for LongMemEval.

**Why.** RV-DES-17 asked for LongMemEval's audit with the registered size and rule; the Benchmarks section says only that other benchmarks are audited with a kit their card builds.

**Result.** GateMem's rule is a seeded draw per kind of the items the primary metric is computed on (25 access control, 25 forgetting). LongMemEval's accuracy is computed on all 500 questions, one kind, so the kit draws 50 at random without replacement with seed 20261103, as GateMem's config. No number was invented; the draw holds 2 abstention questions of the 30.

**Consequence.** For the lead: the tagged text should name LongMemEval's rule (this one, or stratified by question type) before the audit; changing it is one function and its seed.
