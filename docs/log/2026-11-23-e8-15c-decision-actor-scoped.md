---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/actor.ts
  - packages/cli/src/tui/screens/rich.ts
  - packages/cli/src/tui/screens/item.ts
  - packages/cli/src/tui/forms.ts
supersedes: docs/log/2026-11-22-e8-15c-decision-item-page.md
---

**What.** Every screen records the actor its answers were made as and, after a change of actor, draws none of them, saying whom they were made as. r rebuilds the command line from the workspace now; Follow restarts as the new actor and does not poll while covered; the item page builds its graph and versions only from the actor now's answers.

**Why.** The lead's decision on review findings 1 and 2. The earlier entry was wrong: the page read its own `engram events` run unfiltered, so after a handoff sam was shown dana's note.

**Result.** `actor-switch.test.ts`, 14 tests (6 screens, 2 ways to switch, follow and covered). Six mutations of these guards each fail it (milestone-review-tests).

**Consequence.** Forms take the workspace's flags as they are now, unless given or typed.
