---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - packages/core/src/events.ts
supersedes: none
---

**What.** A sweep the store refuses for good records the record's merging content hash, and adoption refuses that record while it holds it and adopts it once changed.

**Why.** Consistency with an erasure's left-in-store records (ADR 0010).

**Result.** The V3-7 test passes.

**Consequence.** The hash of a never-committed record's content is kept in the log.
