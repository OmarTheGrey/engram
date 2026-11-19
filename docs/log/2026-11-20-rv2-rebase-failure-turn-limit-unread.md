---
date: 2026-11-20
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
  - "vitest, before the fix: Error: no reading of UNREAD session [\"mem-inv-bench/mib-02\",\"C5\",\"fake\",8]"
supersedes: none
---

**What.** After the rebase onto RV1 (#55), which merged without a conflict, RV2's rule that readings must read every UNREAD session would have refused every set of readings for a run with a turn-limited UNREAD session.

**Why.** RV1 leaves a session the turn limit cut off out of the blind kit and excludes it as "turn limit". So it has no key entry and can get no reading, but RV2's check still counted it as unread. The two cards were written in parallel, and git merged the lines cleanly.

**Result.** A vitest case with a turn-limited UNREAD session failed, then passed once the check skipped excluded sessions. The session keeps its "turn limit" reason.

**Consequence.** Sessions the kit holds must all be read, and turn-limited ones need none.
