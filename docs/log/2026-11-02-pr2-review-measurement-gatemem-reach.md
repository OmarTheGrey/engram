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
supersedes: docs/log/2026-11-02-pr2-measurement-gatemem-reach.md
---

**What.** The GateMem reach on the pinned full set (`a983828`), against the patterns GateMem scores as a leak and against the leak targets alone, under medium (strict and permissive give identical rows).

**Why.** Review findings P2-2 and P2-3.

**Result.** Scored patterns, access (727): reachable 282 (38.8 percent), located but unreachable 445 (61.2), not located 0; every pattern reachable 133 (18.3). Leak targets only: 260 (35.8), 457 (62.9), 10 (1.4); every target 151 (20.8). Forgetting (763, scored set equals the targets): 565 (74.0), 197 (25.8), 1 (0.1); every target 481 (63.0). 112 access checkpoints carry not_include patterns beyond their targets. A seeded sample of 50 matches is in `audit_sample`.

**Consequence.** Read with the finding entries of the same name.
