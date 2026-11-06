---
date: 2026-11-06
author: claude-agent
type: decision
card: PX2
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0032-simulator-replays-recorded-calls.md
  - packages/pi-extension/src/extension.ts
supersedes: none
---

**What.** A session records each Plane call as an `engram.call` entry (actor, step, policy id and version) ahead of its events, and the whole policy once as `engram.policy`; blocked bypasses are workload steps.

**Why.** The tool calls alone cannot give the item ids and times the plane assigned, a denied write's event has no item, and the extension's actor is not in the session; with the calls recorded, the replay needs nothing outside the file.

**Result.** ADR 0032 amended. Custom entries are never sent to a model, and a write's content was already in the model's tool call, so the session gains no new text the model saw.

**Consequence.** A session written before this change has no call entries and cannot be replayed; only the two fixtures exist, and they were regenerated.
