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
  - packages/runner/test/recorder.test.ts
  - packages/runner/test/session-fixtures.test.ts
  - "make test-one T=packages/runner/test/recorder.test.ts"
supersedes: docs/log/2026-11-21-d1-verify-acceptance.md
---

**What.** Card D1's acceptance passes on the regenerated fixtures. The fifty sessions are recorded through the plane under the medium preset, and one read finds fifty episodic items with their fifty task ids.

**Why.** The generator now draws a session's separate compaction before the recovery, so that a retry directly follows its recovery compaction, as pi writes it. That moved the counts.

**Result.** From `fixtures/sessions/d1/index.json`: 26 sessions with an abandoned branch (17 with a summary, 9 without), 10 with a separate compaction, 9 with a recovery (3 with both), 39 successes and 11 failures. A new test checks that each recovered session runs length cut, omit edit, compaction, retry. 7 recorder tests and 54 fixture tests pass. Sixteen fixture files and the index changed.

**Consequence.** None.
