---
date: 2026-11-21
author: claude-agent
type: finding
card: D3
chapter: discussion
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/induce.ts
  - packages/core/src/plane/promote.ts
supersedes: none
---

**What.** With D2's ref, the plane could check a replay's `induced_from` against the candidate's own sessions instead of trusting the caller's list.

**Why.** The split is checked against the list the caller presents.

**Result.** The runner derives the list from the ref with `parseDistillRef` and D1's index; the plane does not, since mapping a session to its task needs the index, which core does not hold.

**Consequence.** A follow-up could carry task ids in the ref, or pass the index in.
