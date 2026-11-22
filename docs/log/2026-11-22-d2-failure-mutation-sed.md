---
date: 2026-11-22
author: claude-agent
type: failure
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/skill.ts
supersedes: none
---

**What.** The first mutation check of the tab rule did nothing: the `sed` pattern did not match, so the tests passed on unchanged code.

**Why.** The pattern's escaped brackets and parentheses did not match the source's regex literal, and `sed` reports no miss.

**Result.** It was redone from Python with an exact-string assertion, and the tab case then failed as it should. Later mutations used scripts that assert the target text exists.

**Consequence.** None.
