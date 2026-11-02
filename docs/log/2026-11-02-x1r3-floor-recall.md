---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/retrieval.test.ts
  - packages/runner/scripts/retrieval-floor.ts
  - "pnpm exec vitest run packages/runner/test/retrieval.test.ts"
supersedes: none
---

**What.** The shared pipeline's ranking puts what a GateMem question is about in C2's top 20 almost whenever the history holds it.

**Why.** Review round 3 (V-5) found the floor test asked only whether C2 returned anything, so a ranking that ignored relevance passed it.

**Result.** On the fixture, C2's top 20 holds the leak target or the answer on 20 of the 20 checkpoints whose history holds one; the test requires at least 90 percent. With the ranking reversed it holds it on 7 of 20 (35 percent), and the test fails. On the pinned full set (`x1r2-retrieval-floor`) it holds it on 2,109 of the 2,207 checkpoints whose history does (95.6 percent).

**Consequence.** A change to the ranking that loses relevance now fails a test.
