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

**What.** A password written in documentation prose (`Set password=correcthorse in the docs example`, `password: hunter2abc`) stays a REVIEW-tier match.

**Why.** The reviewer asked for it to stay. The text cannot tell a documented example from a real password, and REVIEW only holds the write for a person.

**Result.** Unchanged: claude-mem's generic password rule holds such lines.

**Consequence.** Documentation about passwords waits for a reviewer when the guard is on.
