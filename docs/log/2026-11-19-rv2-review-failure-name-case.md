---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
supersedes: none
---

**What.** Review finding RV2-6: the first pass compared reader names exactly. One member writing "ana" in one file and "Ana" in the other would have counted as two readers.

**Why.** The only checks were "not empty" and "the two names differ".

**Result.** Closed by RV2-1's fix. Each file's reader must be exactly `reader1` or `reader2`, and the two must differ. "Reader2", "reader3", "ben" and "" are refused (vitest, "the readings are two files, one per reader, each reader named once").

**Consequence.** Nothing further.
