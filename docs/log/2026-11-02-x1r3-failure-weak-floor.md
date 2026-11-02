---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/retrieval.test.ts
supersedes: none
---

**What.** The floor test asked only whether C2 returned anything, which any-term matching makes near certain; reversing the ranking passed every runner retrieval test.

**Why.** It tested the candidates, not the ranking.

**Result.** It now also requires C2's top 20 to hold the target on at least 90 percent of the fixture checkpoints whose history holds it (all 20 do today); a reversed ranking gives 35 percent and fails.

**Consequence.** Found by the third review of PR #25 and fixed in its round-3 fix pass.
