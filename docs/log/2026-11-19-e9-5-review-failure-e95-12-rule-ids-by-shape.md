---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Review finding E95-12 (minor): rule ids were printed when they had a bundled policy's shape, so `profile.twin/write/<anything>` could carry a name.

**Why.** A shape check is not a list.

**Result.** `printableRules` lists core's `engram/` ids and the ids the bundled policy builds from its own levels, classes, promotion rules and enabled lints; anything else is `other`. A test checks the `engram/` list against every literal id in core's source, and plants two ids of the right shape that are not on the list.

**Consequence.** A new `engram/` id in core fails the drift test until it is listed.
