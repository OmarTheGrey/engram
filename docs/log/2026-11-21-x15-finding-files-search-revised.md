---
date: 2026-11-21
author: claude-agent
type: finding
card: X15
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - research/results/h2-perf-budget.json
  - packages/adapters/src/files/index.ts
supersedes: docs/log/2026-11-21-x15-finding-files-search-linear.md
---

**What.** The files adapter's search reads every file in the folder on each read; the first entry's large spread across presets was the growing folder, not machine load.

**Why.** Review finding X15-1: in the first run each preset's cells saw the files earlier timed writes had added, up to 733 at "100 items".

**Result.** With a fresh copy per cell, the files adapter's read median is 97 to 108 ms at 100 items and 0.85 to 1.06 s at 1,000, against 3.7 to 5.0 ms and 11 to 23 ms on the fake (`research/results/h2-perf-budget.json`); presets now differ by at most 1.25 times on it. Allowed writes cost 8 to 23 ms at the median, 1.0 to 2.4 times the fake's.

**Consequence.** Not measured at 10,000 items; an index is a store-side change outside this card.
