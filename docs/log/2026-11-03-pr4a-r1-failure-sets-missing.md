---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/scripts/h1_table.py
  - research/results/h1-gatemem-reach.json
supersedes: none
---

**What.** H1's pipeline could not run the analysis v1 recommends: access-control checkpoints as the primary GateMem set, forgetting as secondary, and a sensitivity table without the checkpoints where a plain refusal is scored as a leak.

**Why.** The sessions carried no checkpoint kind, the table pooled every GateMem session into one test, and the refusal-leak checkpoints were counted in PR 2's reach result (access 29, forgetting 12) but not named. Found by part B while writing v1 (orchestrator's items 8 and 9).

**Result.** The converter writes each GateMem session's `kind`; `research/configs/h1-table.json` names the primary set in one line (`gatemem_primary`) and the sensitivity list; `research/results/h1-refusal-leaks.json` names the 41 checkpoints. The planted end-to-end test asserts the primary, both secondary sets and the sensitivity table; mutants ignoring the set, the list or the kind fail it.

**Consequence.** v1's analysis is the tagged commit's.
