---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/adopt-review.test.ts
  - packages/core/src/events.ts
supersedes: none
---

**What.** Review finding I-7 of PR #58: `erasedScopeContent` read every retire event's item of the scope, of any rule, for every record gated, twice per record (probe P9: about 5 s for 300 files over 300 ttl retirements).

**Why.** It selected item ids by `op = 'retire'` alone, then read each item's events, and adoption called it per candidate.

**Result.** It now reads only erase and sweep events, from the events themselves, through a reader made once per adoption that scans only events appended since its last call. A test counts the rows scanned: at most the scope's retire events, against 200 before (decision and finding entries).

**Consequence.** The rest of P9's time is the write gate's `retiredContent`, which this pass does not touch (finding entry).
