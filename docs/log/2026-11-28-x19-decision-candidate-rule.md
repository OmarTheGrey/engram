---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/bench/src/residue/check.ts
  - packages/core/src/distill/induce.ts
supersedes: none
---

**What.** U7's candidate procedure is induced by card D2's rule-based induction (`induceByRule`) from one synthetic session per person whose tool call quotes slot 2's canary, and written into the person scope by the person's agent, as the induction runner writes candidates.

**Why.** The rule method calls no model, so it needs no further cassette; AWM would need a scripted reply per person for the same tier. What the tier tests, that a distilled copy in the person scope is erased with it, does not depend on the method.

**Result.** 20 candidates, each erased with its person.

**Consequence.** None. Cost if wrong: one scripted reply per person.
