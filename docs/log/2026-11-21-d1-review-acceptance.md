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
supersedes: docs/log/2026-11-21-d1-acceptance.md
---

**What.** Card D1's acceptance passes again on the regenerated fixtures. The fifty sessions are recorded through the plane under the medium preset, and one read finds fifty episodic items with their fifty task ids.

**Why.** The generator now writes pi's recovery from a length cut in some sessions, so every fixture file and the counts of the superseded entry changed.

**Result.** From `fixtures/sessions/d1/index.json`: 26 sessions with an abandoned branch (17 with pi's summary, 9 without), 6 with a compaction, 10 with a recovery, and 36 successes and 14 failures. The recorder test checks each item's omitted runs against the index. 7 recorder tests and 53 fixture tests pass.

**Consequence.** Card D2 has fifty governed episodes with branches, compactions and omitted attempts.
