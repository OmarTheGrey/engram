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
  - packages/ui/src/data.ts
  - packages/ui/src/App.tsx
  - packages/server/src/static.ts
  - packages/ui/test/data.test.ts
  - packages/server/test/ui.test.ts
  - test/e2e/inspector.e2e.test.ts
  - fixtures/workspaces/inspector/workload.json
  - "make test-e2e"
  - "pnpm --filter ui test"
supersedes: none
---

**What.** Card E8.5: the inspector v0, a Vite and React page that `engram serve` serves at `/`, with a viewer picker, scope lanes and a timeline with filters and event detail.

**Why.** Gate B's surfaces need a view of the plane as one actor (plan decision 5).

**Result.** Lanes are one `Plane.read` as the viewer through the generated client; the timeline is what `visibleEvents` returns. On the fixture workspace (12 writes and reads), Chromium shows lanes `person:dana` and `team:core` with four items, and 13 timeline rows, equal to `visibleEvents` over the log. `make test-e2e`: 17 passed; `pnpm --filter ui test`: 23 passed; `packages/server/test/ui.test.ts`: 9 passed. Mutations caught: lanes from the projection, and a timeline ignoring `visibleEvents`.

**Consequence.** E8.10 (diff view) builds on these lanes; snapshots wait for it.
