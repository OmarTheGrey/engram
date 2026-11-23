---
date: 2026-11-22
author: claude-agent
type: failure
card: L7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - "make nli-determinism"
supersedes: none
---

**What.** The first `make nli-determinism` after the fetch step was added exited 1: the first child wrote its logits, the second did not.

**Why.** It ran while card L2's fault set was being rebuilt for test-repro with four workers; the error text was cut by a grep, so the cause is not known. A child's spawn timeout of 600 s is the likely one.

**Result.** The rerun on a quieter machine passed: 200 of 200 bitwise identical. The check reads two fresh processes' outputs, so a failed child cannot pass it.

**Consequence.** Run it when the machine is not loaded.
