---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/explain-absent.test.ts
supersedes: none
---

**What.** The first run of the generated property failed: seeding a procedural item with a string content was refused by the event schema (`item.content`: expected object).

**Why.** The test overwrote every item's content with words; a procedural item's content is `{ body, tools }`.

**Result.** Procedural items now get `{ body, tools: [] }` with the words in the body; the property passes, 150 runs.

**Consequence.** None for the plane.
