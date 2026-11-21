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
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-d1-review-decision-source.md
---

**What.** The rule of the superseded entry stands. The recorder sets `model`, or `compaction` when a compaction or a branch summary is in the episode. Web-fetched content would be `external` under ADR 0004, and the recorder cannot detect it today (backlog row "Recorder: external content in sessions").

**Why.** The regenerated fixtures write pi's recovery compaction, so every recovered session is now `compaction`, and the counts changed.

**Result.** In the regenerated fixtures (`fixtures/sessions/d1/index.json`), 26 items are `compaction` (17 branch summaries, 6 compactions, 10 recoveries, overlapping) and 24 are `model`.

**Consequence.** None beyond the superseded entry.
