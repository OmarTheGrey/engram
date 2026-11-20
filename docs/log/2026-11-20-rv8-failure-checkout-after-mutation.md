---
date: 2026-11-20
author: claude-agent
type: failure
card: RV8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/cost_table.py
supersedes: none
---

**What.** After a mutation check on `kept` in `research/scripts/cost_table.py`, `git checkout` on the file also discarded the uncommitted `decided` code.

**Why.** The restore used the committed version, not a copy taken before the mutation.

**Result.** A copy made before the mutation restored the file; the nine cost-table tests pass again, and the two tests that cover the exclusions failed under the mutation as intended.

**Consequence.** Mutate a copy and restore from it, never from git, while edits are uncommitted.
