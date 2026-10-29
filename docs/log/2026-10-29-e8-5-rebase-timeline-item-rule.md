---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ui/test/workspace.ts
  - packages/ui/test/data.test.ts
  - test/e2e/inspector.e2e.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** After rebasing PR 4 onto PR 3's review fixes (`c48d548`), the inspector's tests compute the expected timeline with the new `visibleEvents(viewer, events, { policy, at, current })`, at the fixture's server clock over the projection as it stands.

**Why.** PR 3 made `visibleEvents` withhold an event's item unless the read filter would return it now, so the tests' two-argument calls no longer type-checked. The route evaluates at the request's `at`, else the server's clock; the UI sends no `at`, so the expected timeline uses the same clock (`workload.json`'s `now`) and `currentItems`.

**Result.** One helper, `timelineOf` in `packages/ui/test/workspace.ts`, serves the UI and e2e tests. `data.test.ts` compares the route's answer with it, items included; counts held (13 visible to dana before the page loads, 14 after). `make test-e2e`: 22 passed; `pnpm --filter ui test`: 27 passed.

**Consequence.** The UI shows no event item, so withheld items change nothing on screen.
