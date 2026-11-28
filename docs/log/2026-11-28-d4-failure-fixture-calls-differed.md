---
date: 2026-11-28
author: claude-agent
type: failure
card: D4
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/runner/scripts/run.ts
  - fixtures/distill/d4-drift/revalidation.json
supersedes: none
---

**What.** The first recording of the drift fixture wrote a core fixture its own replay could not reproduce.

**Why.** The fixture carried the run's call counts, and a recording counts 15 new calls where a replay counts none: `cmp` reported the files differ at line 242.

**Result.** A recording now replays itself at once, offline, and writes the fixture from that replay; it throws if the replay makes a new call. Recording and replaying then gave the same bytes (`cmp` silent), "model calls: 0 new, 508 from cassettes".

**Consequence.** The core test's check that the fixture made zero new calls reads a replay's count, not a recording's.
