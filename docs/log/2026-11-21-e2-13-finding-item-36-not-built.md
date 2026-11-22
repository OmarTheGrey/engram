---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.13
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - packages/core/src/plane/read.ts
  - packages/ui/src/view.ts
supersedes: none
---

**What.** Item 36's rule (a non-owner sees only the grants naming them) is not built in core on main: `Plane.read` still returns every grant on an item, and only the inspector's `shownGrants` hides them.

**Why.** The card asked to check, and not to build it here if absent.

**Result.** Backlog rows "Grants seen by a grantee" and "Grants a non-owner sees" still say "decided, not yet built". `whoCanReadItem` applies the same rule to its own answer, so a grantee learns other holders from `Plane.read` today, not from this answer.

**Consequence.** Until item 36 is built, the leak property of this card bounds only what who-can-read reveals, not the read path. The card that builds item 36 can reuse `liveGrants` as this one does.
