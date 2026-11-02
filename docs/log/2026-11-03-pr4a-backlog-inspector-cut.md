---
date: 2026-11-03
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - packages/ui/src/App.tsx
  - docs/log/2026-11-02-x1r3-read-reason-cut.md
supersedes: none
---

**What.** The backlog gains a section of follow-ups from the pre-registration v1 plan, with one row: the inspector does not show a read's `cut` count.

**Why.** PR #25 (review round 3, V-6) made a capped core-pipeline read record what the read limit cut, and its decision entry noted the inspector does not show it yet; the plan's PR 4 asks a backlog row, not a UI change.

**Result.** Before: the follow-up lived only in a decision entry. After: `docs/tasks/backlog.md` names what is left (show `ReadCounts.cut` beside the returned, candidate and filtered counts in `packages/ui/src/App.tsx`) and where it is recorded. No UI code changed.

**Consequence.** The UI card that next touches the explanation view picks it up.
