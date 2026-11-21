---
date: 2026-11-21
author: claude-agent
type: finding
card: B11
chapter: limitations
pillar: research
hypothesis: H5
evidence:
  - packages/bench/src/tau2/plane.ts
  - packages/bench/test/tau2/plane.test.ts
  - fixtures/bench/tau2/script.json
supersedes: none
---

**What.** Under `engram serve`, C5 judged validity and retention by the wall clock (2026), while every item was dated at memory_time (2024-05-15). Medium's person episodic rule has a 90-day ttl, so the plane allowed an episodic write and then filtered it as not active on the next read.

**Why.** Review B11-2. Rows would have depended on when the run happened, and C5 would have hidden what C2 shows for a reason no policy states.

**Result.** The plane's clock is now memory_time. The script's task 19 writes an episodic note, and C5's read on task 16 returns it at rank 2 of 3 (`filtered="0"`). The plane test reads an episodic item back at its own date.

**Consequence.** The fixture cassettes were re-recorded by `make fixtures`'s tau2 lines, from the scripted agents.
