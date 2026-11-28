---
date: 2026-11-28
author: claude-agent
type: decision
card: X18
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/governance-faults/inject.ts
  - packages/core/src/events.ts
  - packages/cli/src/log.ts
supersedes: none
---

**What.** A log fault's corrupted read is the read over the projection replayed from the edited log (events.ts rebuild), and the check's logs keep the hash chain (card E1.6) with salts drawn from the config's seed.

**Why.** The projection is written at append time, so an edited event body changes no read until something replays the log: a new handle or a recovery. Reading the stale projection would call every log fault harmless. The chain is kept so that U6's further column, whether `engram log verify` detects the edit, has a chain to check; verifyChain is the function that command runs (packages/cli/src/log.ts).

**Result.** On the fixture every log fault fails verification and no projection fault does; the unedited control copy verifies UNSIGNED (no checkpoint held), never FAILED.

**Consequence.** B5's own runs keep no chain; the result's limits say an edit to their logs is invisible to verification.
