---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: plane
hypothesis: H3
evidence:
  - packages/core/src/lint/model.ts
  - docs/readings/litreview/2403.08319-knowledge-conflicts-survey.md
supersedes: none
---

**What.** The contradiction lint sends each active semantic item of the scope, held at the lint time, paired with its 5 nearest items by the Jaccard share of their terms (runs of letters and digits, lower-cased), ties by id, skipping exact duplicates and pairs sharing no term.

**Why.** Every pair is quadratic (a LongMemEval scope holds hundreds of items); a new write against its near-duplicates misses dissimilar phrasings, the survey's open question. A bounded neighbour list keeps cost at most 5 calls per item and stays deterministic.

**Result.** On the pilot fixtures: 6 pairs per contradiction fixture, an unrelated item never sent (fixtures/faults/model/contradiction.flag.json).

**Consequence.** Recall is capped by the neighbour rule: a contradiction phrased with no shared term is never judged. L4 should report that bound beside the delta.
