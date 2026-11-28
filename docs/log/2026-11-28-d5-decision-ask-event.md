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
  - packages/core/src/plane/promote.ts
supersedes: none
---

**What.** A hold is an `ask` decision (one `gate` event, no item) under `engram/promote/safety-scan`, not a deny.

**Why.** The lead's brief: hold holds an admission for review rather than refusing. A gate event is how a promotion waits for review (E8.8); the item stays a candidate, so nothing else changes in the log.

**Result.** The held reason begins "held, not admitted", lists the findings and quotes the decision the gate would otherwise have made. The annotation also reaches denies and asks of a procedural item, so a refusal for want of a replay names what the scan found; the opaque membership refusal is left untouched, so it still says nothing about the item.

**Consequence.** Card E2.19 (approval routes) should treat this policy id as a hold whose release needs a reason.
