---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0010-retention-retires.md
  - packages/core/src/events.ts
supersedes: none
---

**What.** Adoption refuses a record under an id the projection does not hold when its merging content hash is one an erasure or sweep of the same scope left in the store (`erasedScopeContent`), not only under the erased item's own id.

**Why.** A moved folder gives an erased Claude Code file a new imported id, and the id-keyed refusal then adopted the erased text again. Linking by ref was the alternative, but a swept record under an id the log never recorded leaves no ref in the log; the scope covers both. Only hashes the events already carry are used.

**Result.** The erased folder, moved, is refused on all four files under `engram/adopt/erased`. Another person's file with the same text, in another scope, still adopts (`packages/adapters/test/plane/offboard-files.test.ts` passes unchanged).

**Consequence.** Cost if wrong: the exact erased text, rewritten by hand in a new file of that scope, is refused.
