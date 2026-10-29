---
date: 2026-10-29
author: claude-agent
type: change
card: E8.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ui/src/view.ts
  - packages/ui/test/view.test.ts
  - packages/server/src/static.ts
  - packages/server/test/ui.test.ts
supersedes: none
---

**What.** Two verifier nits on the PR 4 fix pass: `keepSelection` returns the new viewer's copy of the event, and `isApiPath` treats a path decoding to a NUL (`/api%00/x`, R4-11) as API space.

**Why.** The old copy could carry an item the new viewer's timeline withholds; the NUL broke the first-segment match, so the page fell back to `index.html`.

**Result.** A unit test and three `ui.test.ts` paths cover them; each fails with its fix removed. `pnpm --filter ui test`: 28 passed; `pnpm --filter server test`: 54 passed.

**Consequence.** None.
