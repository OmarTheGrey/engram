---
date: 2026-11-13
author: claude-agent
type: decision
card: L1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0009-retrieval-explanations.md
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** A lint finding names or describes an item outside the linted scope only when the actor could read it at the lint time, by scope or by a live grant; ADR 0009 carries the amendment.

**Why.** A read reveals only a filtered count for an item reached by an expired grant, while a lint finding would carry that item's content hash and retirement. The lint has no filtered count to hide behind, so it must treat such an item as absent.

**Result.** `readableAt` and `liveGrants` in `packages/core/src/policy/evaluate.ts`; `evaluateRead` now uses `liveGrants`, unchanged in behaviour (core unit and invariant tests pass).

**Consequence.** Card L3's model lints should build their reach on `readableAt` too.
