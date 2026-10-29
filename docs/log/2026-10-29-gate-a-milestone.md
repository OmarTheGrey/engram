---
date: 2026-10-29
author: claude-agent
type: milestone
card: none
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/gate-a-e0-e1-e2-plan.md
  - docs/research/preregistration.md
  - packages/bench/PINS.md
  - docs/dogfood.md
  - docs/roadmap.md
  - "make api-check"
  - "ENGRAM_OFFLINE=1 make bench BENCH=gatemem"
supersedes: none
---

**What.** Gate A is declared passed with two recorded exceptions (plan decision 1, pending the lead's review).

**Why.** Extending phase 0 buys nothing: the GateMem live run waits for the backlogged pre-registration and MPBench's release is not the team's to give.

**Result.** Schema without diff: pass (`make api-check`). Pre-registration v0 dated: pass (tag `prereg-v0`). GateMem end to end: the pipeline, rule scorer and ported GPT-4o judge run on 20 pinned checkpoints offline with scripted models (`make bench`). MPBench: unreleased. Files adapter in the CLI: pass for the owner, 2 memories adopted (`docs/dogfood.md`); other members' rows pending. Exceptions, carried into Gate B in the roadmap: (a) GateMem reference numbers within tolerance on the ported judge, after the pre-registration; (b) the poisoning arm on MEM-INV-Bench, released (PINS.md), or BF1 if MPBench is not released by Gate B.

**Consequence.** Phase 1 cards proceed.
