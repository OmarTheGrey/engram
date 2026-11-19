---
date: 2026-11-19
author: claude-agent
type: failure
card: L4
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - docs/research/preregistration.md
  - packages/runner/src/lint-fault-set.ts
supersedes: none
---

**What.** Review finding L4-4: the live-count finding offered a seeded subset of questions as a config change.

**Why.** H3's stopping rule is "all 500 questions and the full seeded-fault set, three seeds", so a subset needs a pre-registration amendment first; and `questions` takes only an explicit list, with no seeded sampler.

**Result.** Superseded by `2026-11-19-l4-review-finding-live-count`, which states both and gives the reviewer's cost table.

**Consequence.** The run's size is the lead's decision, through an amendment.
