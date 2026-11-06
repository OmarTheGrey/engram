---
date: 2026-11-06
author: claude-agent
type: failure
card: E8.9
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/events.ts
  - docs/decisions/0032-simulator-replays-recorded-calls.md
supersedes: none
---

**What.** The workload shape card E0.3 declared, the events of a run, could not carry the simulation card E8.9 asks for.

**Why.** `checkConsistency` puts an item only on allowed changes, a read event records counts and not its query, and events name an actor's id without its memberships, so neither a denied write nor a read can be decided again under another policy.

**Result.** Found while designing the replay, before any code: a stricter and a looser preset could only be compared on writes both allowed. The interface was replaced (ADR 0032), and the surfaces now record calls.

**Consequence.** The interface stubs of E0.3 for lint and distill should be checked against their cards before L1 and D2 build on them.
