---
date: 2026-11-22
author: claude-agent
type: finding
card: L7
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - "make nli-determinism"
  - packages/runner/scripts/nli-determinism.ts
supersedes: none
---

**What.** Scored 200 contradiction pairs of the fixture-size LongMemEval fault set in two separate processes and compared them.

**Why.** The card's first step: if scores differ beyond a stated tolerance, every score is a cached call never recomputed.

**Result.** 200 of 200 logit triples bitwise identical; largest probability difference 0, tolerance 1e-6 (`make nli-determinism`, .engram/nli/determinism/summary.json). Only one machine was available, so the cross-machine check was not done.

**Consequence.** Every score is treated as a cached call anyway: keyed on model hash, runtime and pair, committed under fixtures/cassettes/l7-nli-scores, and never recomputed in a replay. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
