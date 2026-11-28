---
date: 2026-11-28
author: claude-agent
type: decision
card: X16
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/scripts/results_register.py
  - research/tests/test_results_register.py
  - research/configs/results-register.json
supersedes: none
---

**What.** The results register gains the status "proof of concept": a reproducible demonstration that the system works as built, on fixtures, the code's own tests or scripted models, never a hypothesis result; the audit's section uses it, in the group of results serving no hypothesis.

**Why.** The lead's request of 2026-11-28 asks every proof-of-concept result to carry that status, and the register had none such; the addendum says to add it with its test.

**Result.** `test_a_proof_of_concept_is_a_status_and_no_hypothesis_result` passes, and fails when the status is misspelt in the script.

**Consequence.** Other cards of the second plan adding the same status will meet a one-line conflict in `STATUSES`; keep one entry.
