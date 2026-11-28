---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.18
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/properties.ts
  - research/results/h2-cedar-properties.json
supersedes: none
---

**What.** The first non-vacuity run left 12 write counterexamples unreproduced.

**Why.** The solver chose grant flags no pair of Engram items gives (an in-place transition across scopes), and then grants the evaluator's per-grant rules refuse (no class, no expiry; ADR 0021), which the export does not translate.

**Result.** The write domain now keeps the flags consistent, and the decoder writes grants that name the item's class and an expiry. All 20 refutations are then reproduced; the replay records the evaluator's deciding rule (`left_rule`).

**Consequence.** Nothing further.
