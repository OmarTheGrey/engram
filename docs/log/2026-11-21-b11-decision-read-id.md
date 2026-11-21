---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: design
pillar: research
hypothesis: H5
evidence:
  - packages/bench/src/tau2/plane.ts
  - packages/bench/scripts/tau2_memory.py
  - packages/bench/test/tau2/shim.test.ts
supersedes: docs/log/2026-11-21-b11-decision-no-read-id.md
---

**What.** C5's memory_read result carries `read_id` again, exactly as tagRecall renders it. The read id comes from the in-process plane's seeded id source (`sequentialIds("9")`, as the runner's and card B7's planes draw theirs).

**Why.** Review B11-3. The read id was dropped only because `engram serve` draws ids at random, which would break replay. Seeded ids remove that reason and with it the one-attribute difference from the runner's C5.

**Result.** The shim test compares the Python rendering with tagRecall, unmodified. The plane test gives the same read the same id on two fresh planes (`01920000-0000-7000-9000-...`). The fixture's C5 cassettes hold `read_id="01920000-0000-7000-9000-000000000007"` on task 16's read, and both offline runs replayed them with 0 new calls.

**Consequence.** None.
