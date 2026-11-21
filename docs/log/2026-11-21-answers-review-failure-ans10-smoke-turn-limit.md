---
date: 2026-11-21
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
supersedes: none
---

**What.** The first answers pass left the smoke configs without H1's turn limit, so the pre-tag check would not have run H1's cap (review finding ANS-10; this entry was missing from the review fix pass, verification finding V-7).

**Why.** The limit was set only where item 4 said experiment configs.

**Result.** The smoke configs carry `turn_limit` 8, held equal to H1's by the RV6 test.

**Consequence.** A check run mirrors every limit of the run it checks.
