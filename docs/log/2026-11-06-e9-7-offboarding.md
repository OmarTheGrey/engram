---
date: 2026-11-06
author: claude-agent
type: change
card: E9.7
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - fixtures/profiles/offboarding.json
  - packages/core/test/unit/plane/offboard.test.ts
  - packages/core/test/replay/erasure.test.ts
  - "pnpm --filter core exec vitest run test/unit/plane/offboard.test.ts test/replay/erasure.test.ts"
supersedes: none
---

**What.** Card E9.7 added `offboard`: the leaver's items in each handed-over role scope become the successor's, the person scope is erased from the store, the projection and the log's copies, and a deletion report names what was done and what it cannot reach.

**Why.** ADR 0021 and ADR 0010: a role passes to a successor, and person-scope erasure is the one hard deletion, with a report.

**Result.** Under the twin profile, Sam reads both role items after Dana leaves and may rewrite them; none of Dana's five person items is in the store, the projection, a rebuilt projection or any event's text; an agent, or a colleague outside the person scope, is refused with one deny event. 6 acceptance and 4 replay tests pass.

**Consequence.** No surface calls it yet; a CLI command and the Twin screens (E9.4) are follow-ups.
