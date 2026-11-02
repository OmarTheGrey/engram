---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/retrieval.test.ts
supersedes: none
---

**What.** The first fix pass's every-term rule left C2 with no memory on 120 of 180 fixture reads and on 15 of 20 checkpoint questions, and on Mem0 its top-20 cap broke the subset on 45 reads (534 extra entries).

**Why.** The rule was chosen to make C5 a subset of C2 and was tested with short queries only, not with the questions the model will ask.

**Result.** Replaced by one core pipeline with any-term candidates and a floor test; forcing every term back fails the floor test (gap 0.75).

**Consequence.** Found by the second review of PR #25 and fixed in its round-2 fix pass.
