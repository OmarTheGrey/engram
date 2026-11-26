---
date: 2026-11-26
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - README.md
  - research/results/h2-perf-budget.json
  - docs/bundle.md
  - docs/roadmap.md
supersedes: none
---

**What.** The independent review's MEDIUM-1, MEDIUM-2, MEDIUM-4 and LOW-1 to LOW-10 are fixed on `readme-tui`, one commit each.

**Why.** They do not depend on `cliupgrade` merging; HIGH-1 and MEDIUM-3 wait for that merge.

**Result.** The latency limit gives all four budget cells from `h2-perf-budget.json`, one met. Export's bundle is scoped as `docs/bundle.md` says. "Why it exists" now follows "What Engram is", the absorb table follows Status, and card ids are out of the product prose. Also fixed: the offline caveat, PRs #70 to #110, weeks 8 to 14, optional grant fields, `medium-trust`, the tracks as `roadmap.md` has them, two alt texts, the check entry, and RD1, L8, E9.9 and E2.21 named in flight.

**Consequence.** After `cliupgrade` merges, HIGH-1 and MEDIUM-3 are fixed against main.
