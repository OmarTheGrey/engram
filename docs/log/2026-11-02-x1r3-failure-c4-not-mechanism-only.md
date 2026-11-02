---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/retrieval.test.ts
supersedes: none
---

**What.** Round 2 claimed C4 and C5 differ in mechanism only, while C4 showed C2's top 20 with verdicts and C5 filled 20 slots from admitted items: C4 showed 2,793 allowed items on access control against C5's 8,290.

**Why.** The claim was checked on the verdicts, not on the lists the two conditions show.

**Result.** C4 walks to C5's list (`x1r3-c4-walk`); a property test compares the lists through each condition's tool.

**Consequence.** Found by the third review of PR #25 and fixed in its round-3 fix pass.
