---
date: 2026-11-22
author: claude-agent
type: decision
card: L7
chapter: evaluation
pillar: research
hypothesis: H3
evidence:
  - "make nli-determinism"
  - packages/runner/scripts/nli-determinism.ts
supersedes: none
---

**What.** Replaced the card's determinism check on two machines with one on two processes of one machine.

**Why.** Only one machine was available (review L7-7).

**Result.** Two processes scored the same 200 pairs bitwise identical (`make nli-determinism`). That shows the scorer is deterministic within a machine and a runtime build, not across CPUs.

**Consequence.** Every score is treated as a cached call that a replay never recomputes, which is what the card asks when determinism cannot be shown. A check on a second machine stays open. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
