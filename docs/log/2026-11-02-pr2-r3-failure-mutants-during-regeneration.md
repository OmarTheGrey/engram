---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/scripts/h4_power.py
  - research/results/h4-power.json
supersedes: none
---

**What.** A regeneration of the H4 table ran while the mutation checks rewrote `research/analysis/equivalence.py` in the same worktree, and some of its worker processes imported a mutant.

**Why.** I assumed every worker imported the analysis code in its first seconds; workers imported it later, and the run's log showed divide-by-zero warnings from a mutant that drops the variance floor.

**Result.** The run was stopped by its task id before it wrote a result, and the table was regenerated with nothing else touching the sources; the committed table and its MANIFEST hash come from that run. Mutation checks now wait for any run that imports the code.

**Consequence.** None for the result; a mutant run beside a regeneration would have produced a wrong table.
