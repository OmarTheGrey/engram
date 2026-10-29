---
date: 2026-10-29
author: claude-agent
type: failure
card: RN1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/conditions.test.ts
supersedes: none
---

**What.** The first version of the tag-shape test compared the three conditions' rendered reads byte for byte after removing the read id and the rules, and failed on the item ids alone.

**Why.** The runner draws item ids and event ids from one sequence; C5's plane appends a write event before each item, so the same item gets a different id there than in C2 and C3. The ids are names the store gives, not part of the shape.

**Result.** The test numbers item ids by first appearance in each condition before comparing, so everything else, attributes, ranks, escaping and content, is still compared byte for byte; adding an attribute to C5's items fails it.

**Consequence.** None.
