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
  - "make test-one T=packages/runner/test/recorder.test.ts"
supersedes: docs/log/2026-11-21-d1-review-acceptance.md
---

**What.** Card D1's acceptance passes on the fixtures regenerated in pi's recovery order. The fifty sessions are recorded through the plane under the medium preset, and one read finds fifty episodic items with their fifty task ids.

**Why.** A recovered session now writes the length cut, the omit edit, pi's recovery compaction, then the retry, as pi does. That moved the counts of the superseded entry.

**Result.** From `fixtures/sessions/d1/index.json`: 26 sessions with an abandoned branch (17 with a summary, 9 without), 6 with a separate compaction, 10 with a recovery, 35 successes and 15 failures. 7 recorder tests and 53 fixture tests pass. Ten fixture files and the index changed; nothing else in `fixtures/` did.

**Consequence.** None.
