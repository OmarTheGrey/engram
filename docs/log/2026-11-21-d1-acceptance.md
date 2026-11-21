---
date: 2026-11-21
author: claude-agent
type: milestone
card: D1
chapter: evaluation
pillar: distill
hypothesis: none
evidence:
  - fixtures/sessions/d1/index.json
  - packages/runner/src/session-fixtures.ts
  - packages/runner/test/recorder.test.ts
  - packages/runner/test/session-fixtures.test.ts
  - "make test-one T=packages/runner/test/recorder.test.ts"
supersedes: none
---

**What.** Card D1's acceptance passes. The fifty synthetic sessions in `fixtures/sessions/d1/` are recorded through the plane under the medium preset, and one read finds fifty episodic items with their fifty task ids.

**Why.** This is the card's acceptance: fifty fixture sessions recorded with task ids.

**Result.** The generator (`packages/runner/src/session-fixtures.ts`, seed 1, run by `make fixtures`) writes 26 sessions with an abandoned branch (17 with pi's branch summary, 9 without), 10 with a compaction, and 34 successes and 16 failures (`fixtures/sessions/d1/index.json`). pi's own `SessionManager` reads each file with the same final branch and the same leaves as the parser (53 tests).

**Consequence.** Card D2 has fifty governed episodes to induce from. Real tau2 sessions arrive with card B11.
