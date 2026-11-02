---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/conventions/testing.md
  - research/scripts/reproduce.py
supersedes: none
---

**What.** The testing convention now describes layer 8 as `make test-repro`, run by hand before a PR that adds or changes a result merges, not by CI.

**Why.** Plan decision 10 made `make test-repro` rerun every MANIFEST row and allowed a script to fetch pinned benchmark data, which CI's offline runs refuse; the convention still described a cache-only nightly pytest file.

**Result.** Layer 8's row, the CI sentence and the reproduce paragraph changed; the reproduce loop's own tests and the analysis tests stay in `make test`.

**Consequence.** A nightly or main-branch run of `make test-repro` would need a job with network access, left to whoever sets up CI for it.
