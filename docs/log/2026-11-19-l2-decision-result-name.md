---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/configs/h3-fault-set.json
  - research/scripts/h3_fault_set.py
  - docs/tasks/L2.md
supersedes: none
---

**What.** The card's acceptance file, `results/faults_memory_v1.jsonl with counts per class`, maps to `research/results/h3-fault-set.json`: counts per class, keyed and unkeyed apart, and the sha256 of each set file. The set itself goes to `.engram/faults/h3-fault-set/`.

**Why.** The plan names the result under H3's glob, `research/results/h3-*`, and asks that only counts and hashes be committed: the full set is about 500 MB of LongMemEval text, regenerated from the pinned S split by `make test-repro`.

**Result.** One MANIFEST row; the set's four files are hashed in the result, so a later card can check it lints the same set.

**Consequence.** If wrong: committing the labels file (2.9 MB) as well would be one more MANIFEST row.
