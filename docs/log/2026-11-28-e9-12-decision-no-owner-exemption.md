---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/consent.ts
supersedes: none
---

**What.** No writer is exempt: the person's own user-sourced write is refused too when an opt-out covers it, unlike the trust floors' owner exemption (ADR 0040).

**Why.** An opt-out is the person's own rule; Incognito means nothing is recorded. A person who wants their own notes kept names a source in the opt-out (`source: model`).

**Result.** The fixture's Incognito hour refuses Dana's own user write at 10:00 (`research/results/h1-consent-gate.json`, `opt_outs[2]`: 1).

**Consequence.** If people want their own writes through, a later card adds an exemption field; a schema change.
