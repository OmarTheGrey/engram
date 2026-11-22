---
date: 2026-11-22
author: claude-agent
type: change
card: D2
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/induce.ts
  - packages/core/test/unit/distill/induce.test.ts
  - docs/decisions/0045-awm-prompt-adapted-to-tool-use.md
  - docs/research/preregistration.md
supersedes: none
---

**What.** Card D2's review fix pass closes findings D2-1 to D2-10.

**Why.** The review found six important and four minor findings.

**Result.** D2-1: ADR 0046. D2-2 and D2-9: the faithful rule port, proposed as P6. D2-3: a scrub test (`const ep = episode` now fails it). D2-4: kind tests at both ends. D2-5: an id a ref cannot list is skipped before the call. D2-6: two failure entries. D2-7: the YAML subset. D2-8: only a succeeded call counts. D2-10: the wording, the step numbers, and `backlog` in the error. Core's induction tests: 20 pass.

**Consequence.** Card D3 re-records. The lead decides ADR 0046.
