---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-19-e9-5-decision-watch-counters.md
---

**What.** A grant added to an item that once held untrusted content (model, compaction, external) is a violation, not a `watch` count.

**Why.** The coordinator's decision on E95-6: these are exactly the grants the twin profile forbids, and adoption is fixed by its own card.

**Result.** `watch.granted_after_raise` is gone; `watch.provenance_raised` stays. The realistic synthetic log no longer grants the agent's item, as the procedure tells members.

**Consequence.** Supersedes the first pass's decision to count them under `watch`.
