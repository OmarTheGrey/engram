---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/journal.ts
supersedes: none
---

**What.** A holder's start is read from /proc on Linux (clock ticks taken as 100 per second), from ps lstart with LC_ALL=C on other POSIX systems, and from CIM on Windows; if none can be read the lock is kept.

**Why.** etimes is an age, so it inherits the clock's steps and its rounding; an absolute start does not. Refusing when unsure keeps two writers out.

**Result.** No new dependency; the reader is a parameter, so tests need no real process table.

**Consequence.** A kernel with another tick rate would shift starts by under a few seconds per day of uptime; a /proc read of CLK_TCK would need a native call, not built.
