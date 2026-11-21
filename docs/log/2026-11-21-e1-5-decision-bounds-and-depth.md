---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.5
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - specs/README.md
  - Makefile
supersedes: none
---

**What.** The bounds: three handles, two item ids, six fresh contents (at most two outside edits), two offboardings; simulation at 5,000 traces of 60 steps per seed, seeds 1 to 3, 4 threads; Apalache to depth 4.

**Why.** The card asks for a run of a few minutes. A run to depth 6 on the good model was stopped after ten minutes while still at depth 5; depth 4 took about two minutes and is the length of the shortest refutation.

**Result.** Apalache's check is exhaustive only to 4 steps, and the races of card E2.6 need 8 to 22 steps, so beyond that the evidence is the simulation and the scenario tests. specs/README.md states this as randomized simulation plus shallow bounded checking.

**Consequence.** SPEC_DEPTH, SPEC_SAMPLES and SPEC_SEEDS are make variables, so a longer run needs no edit.
