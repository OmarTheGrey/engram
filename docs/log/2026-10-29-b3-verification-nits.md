---
date: 2026-10-29
author: claude-agent
type: change
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/live.ts
  - packages/runner/test/live.test.ts
supersedes: none
---

**What.** Closed three minor points from the verification of card B3's review fix pass.

**Why.** A live run that dies before its first call (for example, with no key) leaves an empty cassette folder, because `liveOptions` creates it. A later `REPLAY=1` on that folder failed with an offline-miss error that pointed the user to `make fixtures`.

**Result.** A replay now refuses a folder that holds no cassette file, with the "no recorded cassettes" message. A new test covers the empty folder, and removing the check fails it. A `///` comment in `packages/bench/src/gatemem/plane.ts` is now `//`. The PR text is corrected.

**Consequence.** None beyond the clearer refusal.
