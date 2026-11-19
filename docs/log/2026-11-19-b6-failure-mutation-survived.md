---
date: 2026-11-19
author: claude-agent
type: failure
card: B6
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/runner/test/research/cost-shapes.test.ts
supersedes: none
---

**What.** A mutation of the cost sizes (C5's list over every turn instead of the admitted ones) survived the first test.

**Why.** None of B5's 20 fixture questions has a turn past medium's ttl at its read time, so the plane-equality test could not tell the filter from no filter.

**Result.** A second test on a synthetic question, its oldest session 91 days before the question, expects 6 items under C2 and 4 under C5; the same mutation now fails it.

**Consequence.** The fixture subset cannot exercise the ttl; tests of it need synthetic dates.
