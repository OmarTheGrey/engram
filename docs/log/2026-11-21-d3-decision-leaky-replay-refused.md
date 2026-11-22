---
date: 2026-11-21
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/plane/promote.ts
  - packages/core/test/unit/plane/promote-replay.test.ts
supersedes: none
---

**What.** A replay naming a task the candidate was induced from, or otherwise unusable, is refused with InvalidCallError before the log is touched, not with a deny event.

**Why.** It is a malformed call, like an invalid scope: the runner's split never builds one, so it can come only from a caller's error.

**Result.** The plane test asserts the throw and an unchanged log length.

**Consequence.** If the lead wants such attempts audited, it becomes a deny event under a new rule id.
