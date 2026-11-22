---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ui/test/diff.test.ts
  - packages/ui/src/diff.ts
supersedes: none
---

**What.** Two diff unit tests failed on first run.

**Why.** jsdiff's word diff makes punctuation a token, so `Monday.` is marked as `Monday`; and a last line without a newline differed from the same line followed by more.

**Result.** The test's word expectations were corrected to jsdiff's tokens, and diff.ts ends both texts in a newline before the line diff, so a newline at the very end is not a change; `same` still compares the raw texts.

**Consequence.** The e2e test checks words, not punctuation.
