---
date: 2026-11-19
author: claude-agent
type: failure
card: B6
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/runner/test/b6.test.ts
supersedes: none
---

**What.** The fixture replay test first expected 16 cached calls and got 24.

**Why.** It counted one reader call per session; B5's scripted sessions make two (the read, then the answer) and the judge one.

**Result.** The expectation is 24 for 8 sessions, with the reason in a comment; the replay makes 0 new calls.

**Consequence.** None.
