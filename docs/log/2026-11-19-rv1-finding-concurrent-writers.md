---
date: 2026-11-19
author: claude-agent
type: finding
card: RV1
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/journal.ts
supersedes: none
---

**What.** Two processes writing the same `--out` folder are not guarded: both append to results.jsonl and usage.jsonl, and the rows of the two interleave.

**Why.** Found by the review of PR #55, outside its findings. The journal opens its files in append mode and takes no lock.

**Result.** Not fixed here. A lock file in the output folder, taken when the journal opens and refused while another process holds it, would guard it; on Windows its holder's death must be detected. Backlog row "Concurrent writers".

**Consequence.** Until then, one run per output folder is the operator's rule.
