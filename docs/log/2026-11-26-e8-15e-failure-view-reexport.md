---
date: 2026-11-26
author: claude-agent
type: failure
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/view/test/package.test.ts
  - packages/ui/src/detail.ts
supersedes: none
---

**What.** The first place found for the inspector's `eventDetail`, once `@engram/view` gave only `eventFields`, was `packages/ui/src/view.ts`. With it there, `packages/view/test/package.test.ts` failed: "is what the inspector's old paths export, function for function", 1 failed of 677.

**Why.** That test holds `packages/ui/src/view.ts` to being exactly `@engram/view`'s exports. Immutable log entries cite that path as evidence, so it stays a one-line re-export.

**Result.** `packages/ui/src/view.ts` was restored. `eventDetail` moved to `packages/ui/src/detail.ts`, which `parts.tsx` and `packages/ui/test/view.test.ts` now import. The view and UI tests passed: 71 of 71.

**Consequence.** Inspector-only view code goes in its own file under `packages/ui/src`, never into the re-export paths.
