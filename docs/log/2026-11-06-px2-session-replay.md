---
date: 2026-11-06
author: claude-agent
type: change
card: PX2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/src/replay.ts
  - packages/pi-extension/test/replay.test.ts
  - fixtures/sessions/s0-interception.jsonl
  - fixtures/sessions/e2-4-eviction.jsonl
  - "pnpm --filter pi-extension exec vitest run test/replay.test.ts"
supersedes: none
---

**What.** Card PX2: the pi extension records its policy and each Plane call as session custom entries, and `replaySession` replays a session JSONL through the plane, with no model and no pi runtime, comparing every event with the one recorded.

**Why.** ADR 0001 decision 4: the session and the Engram log reconstruct each other, and a recorded session is the policy simulator's input.

**Result.** Both fixture sessions replay to their `.expected.json` events with no difference; their events rebuild the log's item state; under the bundled medium preset the E2.4 session's eviction is named as the first difference. 11 acceptance tests pass; the expected files did not change, only the JSONL gained call entries.

**Consequence.** `engram simulate` can take a session once a surface converts one (`sessionWorkload`).
