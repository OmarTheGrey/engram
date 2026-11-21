---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: design
pillar: research
hypothesis: H5
evidence:
  - packages/bench/scripts/tau2_engram.py
supersedes: none
---

**What.** One agent turn may make at most `MAX_MEMORY_ROUNDS = 8` replies of memory calls alone. The ninth raises an error, which ends the task as a row with that error.

**Why.** Memory calls are answered inside the turn, so tau2's `max_steps` never counts them. Without a cap, a model that keeps reading memory would loop until the process timeout and take the rest of its (condition, seed) with it. Eight is not measured. The fixture's script makes at most one memory-only reply per turn, and eight leaves room for a read, several writes and a second read.

**Result.** The cap applies to C2 and C5 alike; C1 has no memory tools.

**Consequence.** If a live model hits it, the row says so (`error`). Card X11 reports how often it happens before trusting the number.
