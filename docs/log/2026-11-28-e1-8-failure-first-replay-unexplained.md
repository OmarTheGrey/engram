---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/model/replay.ts
supersedes: none
---

**What.** The first replays of sampled batches left divergences no finding explained: 34 of 300 at seed 11, then 3 of 800 at seed 12, then 2 of the committed 200.

**Why.** Each was a model and code difference not yet classified: the erase events' order inside one transaction, adoption's skipped repeat denies, and findings F1 to F7.

**Result.** Two became declared normalisations (decision-comparison); the rest became the seven findings, each with a scenario. The committed set now has none unexplained.

**Consequence.** A larger or longer batch may find more; the test fails on the first.
