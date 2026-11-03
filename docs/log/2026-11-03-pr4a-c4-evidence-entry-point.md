---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/c4-evidence.ts
  - packages/runner/scripts/c4-evidence.ts
  - packages/runner/test/research/c4-evidence.test.ts
  - research/scripts/h1_c4_verdict_agreement.py
  - research/scripts/h1_c4_walk.py
supersedes: none
---

**What.** C4's verdict agreement and walk counts on GateMem become rule-9 results through one TypeScript entry point with per-checkpoint rows and two research scripts.

**Why.** PR 3's numbers came from development scripts (`compare-c4-verdicts.ts`, `a84dcab`; `c4-walk-lengths.ts`) that print to the console; the plan's PR 4 asks for both as results, and the PR 3 verifier's N-1 asked for the walk counts.

**Result.** `verdictRow` and `walkRow` take decisions from the stripped mapping and read the hidden labels only to locate leak targets. Tests on the 20 fixture checkpoints hold the counted verdicts to C4's own metadata under both sources, C3's and C4's lengths to the runner's `ungovernedRead` and `c4Read`, and the fixture lengths to PR 3's published ones; mutants swapping the leak sides or inverting the plane's verdict fail them.

**Consequence.** The development scripts stay; the results cite the research scripts.
