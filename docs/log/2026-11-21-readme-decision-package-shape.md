---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/README.md
  - packages/runner/README.md
supersedes: none
---

**What.** Every package README has the same six parts in the same order: a purpose paragraph with a link back to the root, Rules, Main modules (a table), Use, Test, and What is next.

**Why.** The brief asked each to cover its purpose and rules, entry points, testing, usage and next steps; one fixed order lets a reader compare packages and lets a reviewer see a missing part at a glance. Rules come before modules because the rules (no policy logic outside core, no direct adapter calls, no model calls in core) are what a contributor most needs before touching a file.

**Result.** Eleven READMEs, each one or two screens; "What is next" names only cards in `docs/tasks/absorb-plan.md` or `docs/roadmap.md`.

**Consequence.** If wrong, the cost is a later reshuffle of headings, with no content lost.
