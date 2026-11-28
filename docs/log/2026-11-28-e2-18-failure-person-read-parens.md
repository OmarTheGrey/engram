---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.18
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/properties.ts
supersedes: none
---

**What.** The person-read permit had one parenthesis too many, and the binary refused it with `unexpected token )`.

**Why.** A typo in hand-written Cedar text.

**Result.** Fixed; the test of the checks compares every check's right side with the invariant's text.

**Consequence.** Nothing further.
