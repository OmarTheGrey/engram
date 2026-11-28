---
date: 2026-11-28
author: claude-agent
type: change
card: D5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/write.ts
  - packages/core/src/lint/procedural.ts
  - packages/cli/test/tui/__frames__/memory-promote-held-120x40-default.txt
supersedes: none
---

**What.** The TUI's promote screen offers no "Switch to a reviewer and approve" for a hold of the safety scan; it says a reviewer's approval alone does not land the answer and offers "Edit and retry".

**Why.** The review (finding 3): a review alone only re-holds it.

**Result.** Core decides (`reviewCouldLand`, exported from `@engram/core`); the TUI passes the event and branches on the boolean, so `no-policy.test.ts` passes (8 tests). The held frames' reason is now the plane's word for word, and their fixture is marked a core answer no surface produces yet (E8.8, E2.19). Frames: 96 pass.

**Consequence.** `packages/core/src/index.ts` exports two more names.
