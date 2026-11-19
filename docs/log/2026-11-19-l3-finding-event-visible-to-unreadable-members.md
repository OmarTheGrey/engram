---
date: 2026-11-19
author: claude-agent
type: finding
card: L3
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** eventVisibleTo shows an event to any member of its scope, even a member the read matrix stops from reading that scope.

**Why.** Reported by the L3 review. Plane.lint refuses such a member, but the lint events another member caused are still shown to them; model reasons now restate in-scope content, which raises the stakes.

**Result.** eventVisibleTo in packages/core/src/visible.ts tests membership of scope_from or scope_to only, with no readableScope check.

**Consequence.** Backlogged in docs/tasks/backlog.md, not fixed in card L3: a change to visible.ts touches every surface that shows events.
