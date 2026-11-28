---
date: 2026-11-28
author: claude-agent
type: finding
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/log/2026-11-28-e2-14-finding-consent-gaps-for-e9-12.md
  - packages/core/src/schema.ts
supersedes: none
---

**What.** Two consent needs remain open: an opt-out naming one actor, and a person declaring their own opt-outs on a shared server with a record of who declared them.

**Why.** This card settled E2.14's gaps within the schema as it is (decisions on source and declaration authority).

**Result.** Both need a schema change (an actor field; a consent record with its own events) and so a rule 5 pull request, and the second a command with its TUI screen.

**Consequence.** For the lead's backlog; nothing registered depends on them.
