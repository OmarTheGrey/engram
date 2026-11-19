---
date: 2026-11-19
author: claude-agent
type: finding
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle.test.ts
supersedes: none
---

**What.** Orderings R1, R5, R6, R7 and R8 of the verification of PR #44 already held on main, through PR #44's re-check; R8's probe failed only because it called `visibleEvents` with a string for its view.

**Why.** The card asks for each reproduction as a committed test.

**Result.** They are committed as regression tests and pass on main and here; R8 now checks that the conflict's deny event has a reason and a policy id, carries no item, and is shown to Dana but not to Sam or Lee.

**Consequence.** None.
