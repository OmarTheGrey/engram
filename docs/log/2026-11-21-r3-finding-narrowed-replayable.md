---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0032-simulator-replays-recorded-calls.md
  - packages/core/src/replay.ts
  - packages/core/src/plane/simulate.ts
  - docs/research/absorb/long-list.md
supersedes: none
---

**What.** "An event log that replays a decision", the card's wording, is narrowed: Engram's log replays state, and a recorded workload replays decisions; the events alone do not re-decide.

**Why.** ADR 0032's context says so: a denied write's event carries no item, a read's event carries no query, and an event names the actor's id but not the level, memberships or source the gate decides on.

**Result.** What holds: `itemsAt` rebuilds the item set after any event from the log alone (`packages/core/src/replay.ts`, tested in `packages/core/test/replay/`), and the simulator replays a recorded workload through the plane's own gate under any policy (`packages/core/src/plane/simulate.ts`). Replayable reads from the log alone are plan R-072 in `docs/research/absorb/long-list.md`.

**Consequence.** `docs/research/positioning.md` and `docs/architecture.md` state the limit next to the claim.
