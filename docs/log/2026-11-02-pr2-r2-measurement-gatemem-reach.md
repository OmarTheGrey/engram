---
date: 2026-11-02
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-gatemem-reach.json
  - research/configs/h1-gatemem-reach.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h1_gatemem_reach.py --config research/configs/h1-gatemem-reach.json --out research/results/h1-gatemem-reach.json"
supersedes: docs/log/2026-11-02-pr2-review-measurement-gatemem-reach.md
---

**What.** The GateMem reach with bare-pattern counts and an audit sample of 50 checkpoints; the reach numbers are unchanged.

**Why.** Review findings V4 and V5.

**Result.** Under medium (strict and permissive identical): access, scored set, reachable 282, located unreachable 445, not located 0, every pattern reachable 133; leak targets 260, 457, 10, 151. Forgetting: 565, 197, 1, 481. Access checkpoints with a bare pattern: 107 scored, 61 targets; with only bare patterns: 2 and 2; with a yes or no pattern: 48 and 4. Forgetting: 63 with a bare pattern, 5 with only bare ones, 12 with yes or no targets (each of the 12 has both).

**Consequence.** Read with the findings of the same day.
