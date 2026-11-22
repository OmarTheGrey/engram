---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/redact.ts
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** redacted, redactedLintReason and the markers moved from offboard.ts to a new log/redact.ts, which offboard.ts and the chain both import.

**Why.** The skeleton must be defined by the very functions offboarding uses, and chain.ts cannot import offboard.ts (offboard imports events, which imports the chain).

**Result.** offboard.ts re-exports REDACTED as before; its behaviour is unchanged (its tests pass). The card named no such file; it is the closest thing to its goal.

**Consequence.** A change to what an erasure rewrites is one edit in redact.ts, which the drift test then judges.
