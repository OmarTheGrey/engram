---
date: 2026-11-21
author: claude-agent
type: decision
card: L5
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - docs/absorbed.md
supersedes: none
---

**What.** The rare-term veto fires only when each side holds a rare term (in at most 10 of the scope's items) the other lacks; claude-mem fires on one such term on either side. The number and polarity vetoes are likewise substitutions, after hermes-dreaming.

**Why.** The card reads "when the highest-IDF terms of the two items differ". In a small scope every added word is rare, so a one-sided veto would refuse every restatement with a word more, the near-duplicate the tier is for.

**Result.** claude-mem's golden vectors pass under the two-sided rule. Cost if wrong: a pair differing by one added rare qualifier is flagged; the lint reports and a person decides.

**Consequence.** Nothing else.
