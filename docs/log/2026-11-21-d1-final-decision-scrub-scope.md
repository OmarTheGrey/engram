---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/scrub.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Card D1's scrub is a best-effort pre-filter. The guaranteed write-time guard is card E2.9's content guard, applied to every `Plane.write` the recorder makes once the recording policy sets `content_guards.secrets: block`.

**Why.** The lead set this scope for the last fix pass. Three verification rounds kept finding new shapes, and a regex list cannot be complete. The E2.8 schema already carries `content_guards`.

**Result.** The scrub's header lists what it does not cover and names E2.9's guard as the covering control. A backlog row, "Recording policy: the content guard", asks for the setting once E2.9 merges. No registered preset changes.

**Consequence.** No further shape-chasing in D1. A leak the scrub misses is E2.9's to catch at the write gate.
