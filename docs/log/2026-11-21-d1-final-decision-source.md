---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/runner/src/recorder.ts
  - fixtures/sessions/d1/index.json
supersedes: docs/log/2026-11-21-d1-verify-decision-source.md
---

**What.** The rule stands. The recorder sets `model`, or `compaction` when a compaction or a branch summary is in the episode. It cannot see web-fetched content, which would be `external` (backlog row "Recorder: external content in sessions").

**Why.** The regenerated fixtures changed the breakdown cited by the superseded entry.

**Result.** In `fixtures/sessions/d1/index.json`, 26 items are `compaction` (17 branch summaries, 10 separate compactions, 9 recoveries, overlapping) and 24 are `model`.

**Consequence.** None.
