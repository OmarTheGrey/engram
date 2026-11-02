---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_analysis.py
supersedes: none
---

**What.** Review finding P2-10: each bootstrap's seed depended on the contrast's position, so adding another model's sessions changed the primary test.

**Why.** The seed came from the config's seed and a running index over (benchmark, model) pairs sorted by name; a model sorting earlier shifted every later index.

**Result.** The seed is now drawn from the config's seed and a sha256 of (benchmark, model, contrast); a test adds another model's sessions and requires an identical primary test (mutation M10, the old indexing, is killed).

**Consequence.** None beyond the code.
