---
date: 2026-11-21
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/L6.md
  - packages/core/src/supersede.ts
supersedes: none
---

**What.** `acceptedClosures` refuses the whole call with InvalidCallError (400 over HTTP) when any accepted id has no proposed close, before anything is written.

**Why.** A partial application of a person's choice is harder to reason about than a refusal.

**Result.** The tests in core, server, CLI and MCP each check that no event is written.

**Consequence.** A write the gate denies after another allowed one is not rolled back; each is its own decision.
