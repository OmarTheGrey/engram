---
date: 2026-11-19
author: claude-agent
type: failure
card: L2
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/generate.ts
  - packages/bench/scripts/fault-set-check.ts
supersedes: none
---

**What.** Review finding L2-1 (critical) on PR #46: the set could only confirm the deterministic lints, and nothing said so.

**Why.** Each keyed subtype restated its lint's trigger, with near-misses far from the boundary (30 days past the lint time), and the check failed unless every keyed fault was flagged and nothing else was; so deterministic precision and recall were 1.0 by construction. The model tier saw only injected template notes, every labelled pair pre-selected for judging, never LongMemEval's own text; and findings on base items were made impossible, by naming the assistant model and failing on any unlabelled finding.

**Result.** Fixed in the review fix pass: boundary near-misses, cue-free and paraphrased templates, four unsupported-claim variants, base-item findings counted and sampled for audit, and a `limits` field (entries `2026-11-19-l2-review-*`).

**Consequence.** The set is a regression check and an upper bound, stated as such.
