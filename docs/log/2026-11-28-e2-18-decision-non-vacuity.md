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
  - tools/symcc/properties.ts
  - research/results/h2-cedar-properties.json
supersedes: none
---

**What.** Three property groups expected to fail show the proofs are not vacuous.

**Why.** Review finding 3: an implication whose left side allows nothing is proved, so a domain or export bug that made a left set deny everything would make every proof under it empty, with no signal.

**Result.** left-allows-some checks each preset's left set against the empty set for read, write and write without review; model-write-reachable and person-read-by-non-member-reachable check that the premises of the two invariants occur. All 18 checks are refuted, and the evaluator reproduces every counterexample, the write ones through evaluateWrite.

**Consequence.** A change that empties a left set now fails make verify-policy.
