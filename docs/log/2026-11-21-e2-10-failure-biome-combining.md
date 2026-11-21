---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - "make lint"
supersedes: none
---

**What.** `make lint` failed after U+034F joined `INVISIBLE_FORMATTING`: biome refuses a combining mark inside a character class.

**Why.** Review E2.10-5 asked for U+034F and U+180E to fold.

**Result.** U+034F is now an alternative beside the class; the screen tests and the corpus result are unchanged by it.

**Consequence.** None.
