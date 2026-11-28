---
date: 2026-11-28
author: claude-agent
type: decision
card: X16
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - research/configs/gate-mutation-audit.json
  - fixtures/mutants/
supersedes: none
---

**What.** The one test that must kill a mutant is always an invariant's own property test, named once in the config by its file and exact test name; a mutant file names only the invariant, and a run selects exactly that test by name.

**Why.** The card counts killed mutants per invariant. Pairing a mutant with a unit test would measure that test, not the invariant. The chain invariant (card E1.6, `make test-invariants` calls it the ninth) is included as `I9`, and the two-handle walk as `I1H`.

**Result.** Ten invariant tests, each with two to eight mutants.

**Consequence.** A survivor says the invariant's test misses the bug, not that no test in the repository does. If wrong, a mutant another suite kills is reported as a survivor; its note says which kind it is.
