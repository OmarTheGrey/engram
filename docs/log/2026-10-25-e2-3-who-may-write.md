---
date: 2026-10-25
author: claude-agent
type: change
card: E2.3
chapter: implementation
pillar: plane
hypothesis: H1
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/src/plane/write.ts
  - packages/core/src/actor.ts
  - packages/core/test/unit/policy/evaluate.test.ts
  - packages/core/test/unit/plane/write.test.ts
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - "pnpm exec vitest run packages/core/test/unit/plane/write.test.ts"
supersedes: docs/log/2026-10-25-e2-3-write-path.md
---

**What.** Replaces the write gate described in the card E2.3 entry: it now decides on the actor as well as the item, and every outcome is an event.

**Why.** Review findings R5-3 to R5-7, R5-9 and R5-14, and decisions D4 and D6: a non-member could write into another person's scope, a caller could claim user provenance and grant to everyone, and a store failure left no event.

**Result.** Before the policy rule, the gate checks membership (`engram/write/membership`), a rewrite's owner and version (`engram/write/version`) and grants (`engram/write/grant`). A level with no rule is denied under `engram/write/default-deny`, not `<policy>/write/<level>` as the superseded entry said. `Actor.source` overrides provenance. A store failure is one `engram/write/store-failure` event and a rethrow; an invalid actor or time is refused before the store and the log.

**Consequence.** Harnesses must set `Actor.source` for provenance to be the plane's.
