---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/parity.test.ts
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** The failure entry on the expired-grants mutant said it failed tests across HTTP, MCP and pi; that run had not included the CLI suite.

**Why.** I ran the mutant against three files, not four (review finding 10).

**Result.** Rerun on all four suites (`liveGrants` admitting expired grants, reverted after): 8 tests fail, among them the expired grantee through the CLI and through the TUI, and the TUI screen check.

**Consequence.** Every surface catches it.
