---
date: 2026-11-28
author: claude-agent
type: decision
card: X16
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/scripts/gate_mutation_audit.py
  - research/tests/test_gate_mutation_audit.py
supersedes: none
---

**What.** A mutant is killed only when its test failed by an assertion: vitest's `AssertionError`, or a fast-check predicate returning false, anywhere in the error's chain of causes. A crash, a file that does not load, a timeout, an unhandled error or a filter that did not run exactly the named test is could-not-tell, and stops the run with an error instead of being recorded.

**Why.** Plur's `bite.py` counts only assertions as kills: a mutant that crashes the code says nothing about the test. Bite reports could-not-tell and goes on; a committed result must not carry a verdict nobody can vouch for.

**Result.** On the committed run every one of the 34 mutants was judged, 29 killed and 5 survived; none was could-not-tell.

**Consequence.** A future code change that makes a mutant crash fails `make test-repro` on this row; the mutant is then rewritten against the new code.
