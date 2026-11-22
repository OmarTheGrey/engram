---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
supersedes: none
---

**What.** The dogfood report's `printableRules` admits only preset ids of letters, so `preset.medium-trust`'s rule ids would print as `other`.

**Why.** Found while adding `engram/write/downgrade` to its list.

**Result.** The twin dogfood runs the twin profile, so nothing prints wrongly today.

**Consequence.** A card that runs the dogfood under `medium-trust` widens the pattern.
