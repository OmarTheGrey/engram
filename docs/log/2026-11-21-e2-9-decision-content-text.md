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
supersedes: none
---

**What.** For structured content the guard scans each key, string value and number (as JSON writes it), one per line; booleans and null are not text.

**Why.** Numbers were turned into the empty string, so `{card: 4111111111111111}` passed under `pii: block` (E2.9-2). One line per leaf keeps a key and its value apart, which costs one evasion.

**Result.** A card stored as a number is denied; `contentText(12n)` is `12`.

**Consequence.** A secret split between a key and its value is not found; it is listed in the result's limits.
