---
date: 2026-11-19
author: claude-agent
type: decision
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/scripts/lint_scores.py
  - research/tests/test_h3_lints.py
supersedes: docs/log/2026-11-19-l4-decision-matching.md
---

**What.** A tier flags a label only when a lint the label names lands on its `finding_on`: a fault's `expected` lints, a near-miss's `near_miss_of` lints. Any other finding gives no credit and is unverified.

**Why.** Review finding L4-1: with any lint of the tier, a lint built for something else gave a fault recall and made a near-miss a false positive of its class.

**Result.** Wrong-scope, whose labels name no lint, has recall 0 under either tier by construction. Tests: an orphan near-miss flagged only by unsupported-claim gives orphan false positives 0 and unverified 1; a wrong-scope fault flagged by contradiction gives recall 0. The floor's numbers are unchanged.

**Consequence.** The per-lint tables and the class tables now agree on what counts.
