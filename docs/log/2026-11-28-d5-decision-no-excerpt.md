---
date: 2026-11-28
author: claude-agent
type: decision
card: D5
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/lint/procedural.ts
  - docs/decisions/0039-content-guards-at-the-write-gate.md
supersedes: none
---

**What.** A finding names its rule, class, severity, field and offsets, never the matched text.

**Why.** Caura quotes up to 200 characters of the match; recording a payload in an event's reason would echo it into the log and into any context the log is read into, the reason ADR 0039 (item 4) gives the injection screen no excerpt.

**Result.** `findingText` prints, for example, "critical shell-injection (fetch-pipe-shell) in body at 11 to 51".

**Consequence.** A reviewer reads the span from the item, which they can read anyway.
