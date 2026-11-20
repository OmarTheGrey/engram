---
date: 2026-11-20
author: claude-agent
type: finding
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/adopt-review.test.ts
supersedes: none
---

**What.** After I-7, probe P9 (300 new files over 300 ttl retirements) adopts in about 4.3 s, against 9.6 s on branch rv4 before this pass; on `f19b1b3` the same script took 6.8 s for 600 writes, since that code re-adopted the plane's own writes.

**Why.** Measured once each on this loaded machine with a scratch copy of the probe (not committed), so the numbers are indicative. Making the write gate's `retiredContent` return nothing cut P9 to 2.8 s.

**Result.** About half of what remains is `retiredContent` (packages/core/src/plane/write.ts), which reads every item of the scope and one event per retired item for every write. It predates card RV4.

**Consequence.** A backlog candidate for the lead: index retired content per adoption, as this pass did for erased content.
