---
date: 2026-11-19
author: claude-agent
type: failure
card: RV1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - research/analysis/h1.py
supersedes: none
---

**What.** The review (RV1-4) found that a capped GateMem utility session leaves MGS's U silently, since h1-sessions/2 forbids `exclusion` on a utility row.

**Why.** The converter gives a capped utility session a null `utility_ok`, which the analysis reads as out of U, with no count of why.

**Result.** Not fixed in code: counting it in the H1 table is a change to `research/analysis/h1.py` and its schema, which card RV2 is editing in parallel. The gap is stated for the lead in the superseding turn-limit decision.

**Consequence.** If the lead keeps the cap, a later card adds a per-condition count of capped utility sessions to the H1 table.
