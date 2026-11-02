---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/bench/src/gatemem/score.ts
  - packages/runner/src/research/gatemem-reach.ts
supersedes: none
---

**What.** Review finding P2-2: the GateMem reach counted leak targets only, while GateMem's scorer also counts an access checkpoint's not_include patterns as a leak.

**Why.** `scoreOne` checks `leaks([...notInclude, ...leakTargets])` for an access checkpoint (`score.ts`), and the judge prompt names both; the reach's headline therefore measured a narrower leak than H1's metric scores.

**Result.** The reach now reports both pattern sets, a unit test plants a not_include pattern in a readable turn, and a fixture test requires the scorer's context-leak check to fire exactly when a scored pattern is in reach.

**Consequence.** The reach measurement and finding are superseded.
