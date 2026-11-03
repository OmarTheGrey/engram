---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - packages/bench/PINS.md
  - docs/decisions/0029-poisoning-arm-mem-inv-bench.md
supersedes: none
---

**What.** Recommended, for the lead's decision: v1 registers MEM-INV-Bench for H1, and MPBench moves to the candidates of `packages/bench/PINS.md` (decision sheet item 15).

**Why.** Plan decision 8 and ADR 0029: MPBench has no release and no pin.

**Result.** The move is on this branch (`docs/log/2026-11-03-pr4b-pins-move.md`); MPBench may return by amendment before card X3.

**Consequence.** If the lead keeps MPBench, the move is reverted and v1 cannot name its items.
