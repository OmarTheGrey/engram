---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/episode.ts
supersedes: none
---

**What.** A session's task id is read from its first pi `custom` entry with `customType: "engram.task"` (`data.task_id`). A branch's verdict is read from its last `engram.outcome` entry (`data.verdict` is success or failure, with an optional `data.reward`).

**Why.** pi has no task or outcome field. Custom entries are pi's place for extension state (session-format.md), and they stay out of model context. Card D1 left this choice open.

**Result.** If a session has no such entries, its task id and verdict are null. The stop reason of the final assistant message is always kept. The fixtures write both entries.

**Consequence.** Card B11's tau2 runner must append an `engram.task` entry and an `engram.outcome` entry to each session (the reward as the verdict) for its sessions to be recorded with task ids. If it uses another convention, the parser changes.
