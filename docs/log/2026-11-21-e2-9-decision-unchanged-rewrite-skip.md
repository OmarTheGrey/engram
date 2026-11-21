---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/test/unit/policy/secrets.test.ts
supersedes: docs/log/2026-11-21-e2-9-decision-what-is-judged.md
---

**What.** The guard skips a write only when an item exists, keeps its content, scope and class, and is active or lands retired; every other write is judged, a new item written retired included.

**Why.** The superseded entry skipped every retired item and every unchanged active rewrite. The review found both holes: an active item holding a key could be moved into a team scope unjudged (E2.9-3), and a new item written retired stored a key with its value in the event (E2.9-4).

**Result.** Tests: a move and a class change are judged; a new retired item is denied under block; retiring a held candidate unchanged is allowed, at the Plane too, under review and under block.

**Consequence.** Rejecting a candidate must keep its content; a retire that also edits it is judged.
