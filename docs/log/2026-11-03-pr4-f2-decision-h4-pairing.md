---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/analysis/equivalence.py
  - research/tests/test_equivalence.py
supersedes: none
---

**What.** H4's pairing is `complete_item_differences(a, b, seeds)` in `research/analysis/equivalence.py` (V-19). It returns the items both arms kept on every seed, their mean differences, and the items dropped. There is no guard inside `paired_item_differences`.

**Why.** H1's table pairs through `paired_item_differences` and must keep items averaged over the seeds left (the pre-registration's pairing rule), so the two hypotheses need two functions.

**Result.** The test plants items that lost a seed under either arm, or had one excluded, and checks that they are dropped and counted.

**Consequence.** H4's table, written after Gate C, calls this function and reports the dropped count.
