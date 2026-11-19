---
date: 2026-11-19
author: claude-agent
type: decision
card: B6
chapter: design
pillar: research
hypothesis: H2
evidence:
  - packages/runner/src/research/longmemeval-clock.ts
  - research/configs/h2-longmemeval-ttl.json
supersedes: none
---

**What.** The clock measurement writes every turn through Plane.write and reads with no query text at three clocks, under the three presets, on the fake store.

**Why.** The task asks for the plane's own read filter; a read with no text makes every reachable item a candidate, so the read returns exactly what the filter admits, and its reason splits the rest by cause. Strict and permissive cost two more passes and price the preset option.

**Result.** Clocks: B5's read time, the last turn's time, and 2026-11-19 standing for a live run's wall clock (a later run hides at least as much). Evidence labels are read only after the reads. Medium at B5's read time gives L2's count exactly (`l2_check.equal`).

**Consequence.** `check_row` reran this result and the cost table in 14 minutes 44 seconds with ENGRAM_RESEARCH_WORKERS=10, to the same bytes as the first run on 16 workers.
