---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.18
chapter: design
pillar: plane
hypothesis: none
evidence:
  - research/configs/h2-cedar-properties.json
  - research/results/h2-cedar-properties.json
supersedes: none
---

**What.** A control property is checked beside the card's three: the converse of the monotone one, expected to fail.

**Why.** A proof is worth something only if the same pipeline can refute; and the card's replay of a counterexample through evaluateRead would otherwise never run on the presets, since every property holds.

**Result.** Medium before strict and permissive before medium are refuted, and the evaluator reproduces both counterexamples (left allows, right denies, decoded faithfully). A run where the control is proved, or its counterexample is not reproduced, is not as expected and fails make verify-policy.

**Consequence.** Nothing beyond the result; the control is labelled so in the config and the result.
