---
date: 2026-10-29
author: claude-agent
type: finding
card: E8.5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/ui/src/data.ts
  - packages/ui/test/data.test.ts
  - test/e2e/inspector.e2e.test.ts
supersedes: none
---

**What.** Every load of the scope lanes appends one read event, made by the viewer at the server's clock.

**Why.** Decision 5 takes the lanes from `Plane.read` so they pass the read filter and leave an event (rule 2); the cost is that looking at the inspector writes to the log.

**Result.** On the fixture workspace the log holds 15 events after the workload and 16 after the page loads; the viewer's timeline shows 13, the last being the lanes' own read, whose id the lanes print. The UI loads the lanes before the timeline so the new read is on it, and renders without React's StrictMode, whose doubled effects would read twice in development.

**Consequence.** A busy inspector grows the log by one read per viewer change; E8.10's snapshots, read from events, would avoid it for past states.
