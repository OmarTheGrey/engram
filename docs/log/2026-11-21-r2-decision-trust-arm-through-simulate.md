---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/core/src/simulate.ts
  - packages/runner/src/gatemem-probe.ts
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-21-r2-decision-trust-arm-by-decision-identity.md
---

**What.** The trust-floor arm (now P5) rebuilds each recorded session into a workload: the harness's ingestion, then the memory calls in the row's `tool_calls`. It runs each through `engram simulate`, with medium as the baseline and the trust variant as the candidate.

**Why.** The earlier text had events replayed and decided again, which core rules out: a denied write's event carries no item, and a read's event carries no query (`simulate.ts`).

**Result.** Decisions up to a session's first divergence are exact. Later ones run the recorded model calls against a state the model never saw, so they are counterfactual and reported as such. The arm counts sessions with a divergence and where it first falls, comparing decisions without `policy_id`.

**Consequence.** If a divergence falls on a registered benchmark, it goes to the lead under ADR 0040, decision 8.
