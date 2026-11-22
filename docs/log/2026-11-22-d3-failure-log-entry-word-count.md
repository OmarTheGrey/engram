---
date: 2026-11-22
author: claude-agent
type: failure
card: D3
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - docs/log/2026-11-22-d3-decision-lead-pass-rule-ties.md
  - "make lint-docs"
supersedes: none
---

**What.** `make lint-docs` failed once in card D3's verification fixes. The new entry `2026-11-22-d3-decision-lead-pass-rule-ties.md` had a 159-word body, over the limit of 150.

**Why.** The entry restated the pooled-rate tests beside the tie tests.

**Result.** With that sentence cut, the body is 146 words and `make lint-docs` exits 0.

**Consequence.** Each entry's word count is checked before the gate runs.
