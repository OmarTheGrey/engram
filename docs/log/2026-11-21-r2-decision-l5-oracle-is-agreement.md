---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - docs/research/preregistration.md
  - docs/tasks/L5.md
supersedes: none
---

**What.** P4's measure (a) reads card L5's step 3, the datasketch run on the fault catalogue, as an agreement rate between the MinHash estimate and the oracle. It is a check of the implementation, not a recall.

**Why.** Card L5's step 3 says the script checks "precision and recall" against datasketch. But datasketch estimates the same Jaccard similarity the lint estimates: agreement with it shows the code is right, not that the lint finds the duplicates a person would call duplicates. Recall needs labels, and only card L2's audit sample supplies judged findings.

**Result.** P4 reports (a) as agreement with a Wilson interval, and precision on natural memory from (b)'s judged audit sample. It reports no recall on natural memory.

**Consequence.** Card L5's script may still compute its figures. Only the agreement figure enters the arm, once the arm is registered.
