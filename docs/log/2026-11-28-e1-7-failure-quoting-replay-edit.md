---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/model/trace-replay.test.ts
supersedes: none
---

**What.** The edit script for `replay.ts` failed with a syntax error: a triple-quoted string ended at `"E18-F5""""`.

**Why.** Four quotes in a row close a Python triple-quoted string one quote early.

**Result.** Rewritten with single-quoted triple strings; the edit applied once.

**Consequence.** Nothing.
