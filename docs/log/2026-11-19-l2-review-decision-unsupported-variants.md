---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/generate.ts
  - packages/bench/src/faults/labels.ts
supersedes: none
---

**What.** An unsupported-claim pair is one of four variants, picked by the seed and recorded as the label's `variant`: another attribute than the aside's, another value of its attribute, the aside's claim without its qualifier, or the aside's claim with a qualifier it lacks. The near-miss restates the aside, qualifier included, in one of three note wordings.

**Why.** Review finding L2-1: a claim about another attribute is the easiest case for a model; another value contradicts the source, and a dropped or added qualifier ("at least for now", "on weekdays", ...) is the hard one.

**Result.** A test parses each claim and source and checks each variant's relation, and fails when another-value claims the aside's own value.

**Consequence.** L4 can report model recall per variant.
