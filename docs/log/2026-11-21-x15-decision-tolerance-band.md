---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: evaluation
pillar: plane
hypothesis: H2
evidence:
  - research/configs/perf-budget.json
  - research/results/h2-perf-budget.json
supersedes: none
---

**What.** The rerun check passes when each cell's new median is within a factor of 4 of the committed one, either way, with every query count equal, and it refuses samples from another machine.

**Why.** The card asks for a stated band and leaves its width open. Within the committed run, cells doing the same work under different presets had medians up to 3.86 times apart (the files adapter's read at 100 items), because about ten agents shared the machine. A band narrower than the run's own spread would fail on load alone. It was fixed from that run before any rerun.

**Result.** The band is wide; it catches a change of the order of a lost index or a new scan of the log, not a 20 percent regression.

**Consequence.** On a quiet machine a later card can narrow it, with a new committed run.
