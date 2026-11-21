---
date: 2026-11-21
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/L6.md
  - packages/core/src/supersede.ts
supersedes: none
---

**What.** A window that covers no time (`valid_from` not before `valid_to`) is reported by `wellFormed` and goes to review. It is not thrown on, as gaptime's `assertValidInterval` does.

**Why.** The log can hold such items, and a helper that throws would stop a whole plan over one bad item.

**Result.** Unit tests in test/unit/lint/intervals.test.ts. `overlaps` is false for an empty window.

**Consequence.** None.
