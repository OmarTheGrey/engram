---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/core/src/plane/retrieve.ts
  - packages/runner/src/conditions.ts
  - docs/decisions/0009-retrieval-explanations.md
  - packages/runner/test/retrieval.test.ts
supersedes: docs/log/2026-11-02-x1r-plane-match-every-term.md
---

**What.** Every condition retrieves with one pipeline defined in core: candidates holding any query term (words lower-cased, edge punctuation removed, no stopword list), each scored on its own by term share, confidence and recency, cut to the read limit. C2 to C4 run it over what the store lists; C5 reads through a plane built with it, after its filter, never searching the store.

**Why.** The every-term rule floored H1 out (review round 2, R1); the orchestrator chose one core pipeline for every condition.

**Result.** C2's list is the pipeline over every item and C5's over what the plane admits, on every fixture checkpoint and nine queries; without the limit C5 is a subset of C2 in C2's order. Breaking either side fails 11 and 24 tests.

**Consequence.** The product's default read is unchanged; ADR 0009's amendment is proposed.
