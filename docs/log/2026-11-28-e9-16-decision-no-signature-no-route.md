---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.16
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/E9.16.md
  - packages/core/src/audit/ropa.ts
supersedes: none
---

**What.** Neither the subject report nor the record is signed through E9.15's DSSE path, and no server route, MCP tool or inspector page is added.

**Why.** The card names none of them. The record holds no log head, so a signature would vouch only for a rendering of the policy, and the subject report goes to the subject alone.

**Result.** Two CLI commands, the TUI wiring and core functions only.

**Consequence.** Signing the record beside an audit report is a small later step if the lead wants it. Cost if wrong: a follow-up card.
