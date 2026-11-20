---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/journal.ts
supersedes: none
---

**What.** Of the review's two fixes for P60-3, both: a merge writes `run.json` only after it seals, and an unsealed merge's files are removed when its journal closes.

**Why.** Without `run.json` a later resume already refuses the folder, but a fresh run would still find rows it does not own until it cleared them; removing them makes every failure path, the runner's pass throwing included, leave an empty folder.

**Result.** One rule in `RunJournal.close`, not in each caller; `sealMerge` only checks.

**Consequence.** None beyond P60-3's fix.
