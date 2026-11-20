---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/events.ts
  - packages/core/test/unit/plane/adopt-review.test.ts
supersedes: none
---

**What.** For I-7, `erasedScopeContent` returns a reader made once per adoption that scans only the scope's retire events appended since its last call, instead of a set computed once at the start.

**Why.** An adoption decides in the write queue so it sees an offboarding queued before it; a set frozen at the start could miss erase events committed meanwhile. The reader reads each event once and still sees new ones.

**Result.** The cost test counts the rows scanned: at most the scope's retire events.

**Consequence.** None measurable on the probe; the reader holds a set per adoption.
