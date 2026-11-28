---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/core-determinism-rule.test.ts
  - scripts/test/pi-import-rule.test.ts
  - research/scripts/crosswalk.py
supersedes: none
---

**What.** The rule blanks comments, strings, template text and regex literals with its own small scanner, rather than a Biome rule (as `pi-import-rule.test.ts` uses) or the TypeScript compiler API.

**Why.** Biome's `noRestrictedGlobals` cannot refuse a member like `Date.now` while allowing `new Date(x)`, and TypeScript 7.0.2, the pinned version, ships no JavaScript parser API. A scanner like the crosswalk's keeps the rule dependency-free.

**Result.** A test checks every core file blanks to balanced brackets, so a misread string or regex would show; probes cover nested templates and a regex inside `${}`.

**Consequence.** A misread construct could hide a call; the bracket check makes that unlikely, not impossible.
