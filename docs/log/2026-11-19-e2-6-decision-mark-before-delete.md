---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - docs/decisions/0007-write-gate-and-source-isolation.md
supersedes: none
---

**What.** Offboarding marks its erasure under the lock before deleting records, rather than deleting every erased ref a second time after the erasure commits.

**Why.** With the mark, every store write for an erased item is followed by a check that sees it, so it is either deleted with the erasure or by its own writer. A second delete pass leaves a window after it and leaves the record behind if the process stops between the commit and the pass.

**Result.** Writes decided after the mark are refused at once; writes decided before it delete what they wrote (R1, R3, R9b).

**Consequence.** A stopped offboarding leaves its person scope frozen, not leaking, until it is run again.
