---
date: 2026-11-28
author: claude-agent
type: decision
card: D4
chapter: design
pillar: distill
hypothesis: none
evidence:
  - docs/decisions/0046-replay-validation-source.md
  - packages/core/src/plane.ts
supersedes: none
---

**What.** `Plane.revalidate` gets no HTTP route, MCP tool, CLI command or pi tool in this card; its decisions reach every surface as events.

**Why.** ADR 0046 point 7 keeps a presented replay off every surface until verified actors are trusted to say `user`, and `Plane.promote`'s replay is still on none. A re-validation presents the same kind of replay, so the same rule holds. The runner, which presents it in process, is the one caller, as for D3.

**Result.** A retirement shows wherever events do: `engram events`, the TUI item screen's history with the retire event's rule and reason, and the item's status `retired` on the item and memory screens.

**Consequence.** Exposing it is one card with `Plane.promote`'s replay, after the lead lifts ADR 0046 point 7.
