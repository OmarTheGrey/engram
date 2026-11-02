---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/retrieval.test.ts
  - docs/decisions/0009-retrieval-explanations.md
supersedes: none
---

**What.** Every store H1 might run on (fake, files, Letta, Mem0) satisfies the retrieval property, since no condition uses a store's native search.

**Why.** Review round 2 (R1) asked which stores satisfy C2 = pipeline over every item and C5 = pipeline over the admitted ones, so PR 4 can pick H1's store; under the store-search rule Mem0's top-20 cap broke the subset on 45 of 180 fixture reads.

**Result.** C2 lists the store and runs core's pipeline; the conformance suite holds every store to `list` returning all it holds, and the test checks C2 on fake for every fixture checkpoint and on files, Mem0 and Letta for two. C5 reads the plane's projection, which no store affects.

**Consequence.** H1's numbers do not depend on the store; a semantic store's own retrieval is not part of the experiment.
