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
supersedes: docs/log/2026-10-29-gate-a-milestone.md
---

**What.** Gate A is declared passed with two recorded exceptions (plan decision 1, pending the lead's review), restated with each criterion's state.

**Why.** The superseded entry left the GateMem and MPBench criterion without a state (review finding P6-9).

**Result.** Schema without diff: pass (`make api-check`). Pre-registration v0 dated: pass (tag `prereg-v0`, now v0.2). GateMem and MPBench end to end: partial. GateMem's pipeline, rule scorer and ported GPT-4o judge run on 20 pinned checkpoints offline with scripted models (`make bench`), with no comparison against the paper; MPBench is unreleased. Files adapter in the CLI: pass for the owner, 2 memories adopted (`docs/dogfood.md`). Exceptions, now pass criteria of Gate B in the roadmap: (a) GateMem reference numbers within tolerance on the ported judge, after the pre-registration; (b) the poisoning arm's benchmark chosen and dated: MPBench if released, else MEM-INV-Bench (a checked candidate in PINS.md), else BF1.

**Consequence.** Phase 1 cards proceed.
