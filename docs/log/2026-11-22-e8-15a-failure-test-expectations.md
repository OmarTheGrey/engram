---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/events.test.ts
  - packages/cli/test/registry.test.ts
supersedes: none
---

**What.** Three of my own tests failed for the wrong reason before passing: events assumed an actor sees all its own events, its fixture wrote as sam with no `--owner`, and the registry's source scan matched `options: SessionOptions` and missed `OPTIONS["log verify"]`.

**Why.** visibleEvents shows only events in scopes the actor reads as a member, and a files store needs `--owner`.

**Result.** Fixed the expectations (dana sees her person scope; a member of team:platform also sees the denied team write) and the scan's patterns; no code changed for them.

**Consequence.** None.
