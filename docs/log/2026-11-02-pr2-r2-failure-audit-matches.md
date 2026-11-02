---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/scripts/h1_gatemem_reach.py
  - research/tests/test_research_scripts.py
supersedes: none
---

**What.** Review finding V5: the audit sample drew matches, not checkpoints, so a hand audit could not estimate the share of reachable checkpoints whose match is the secret.

**Why.** Checkpoints with many matching patterns were over-represented, and a checkpoint's other matches were missing beside the one drawn.

**Result.** The sample now draws 25 seeded reachable checkpoints per kind, each with all its patterns and matches; a test checks each sampled checkpoint carries exactly its row's matches.

**Consequence.** None beyond the result.
