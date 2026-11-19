---
date: 2026-11-19
author: claude-agent
type: finding
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** A read returns every grant on each item it returns, so a grantee reading through the API, the CLI or MCP learns who else may read the item.

**Why.** Grants are fields of the item and the read path returns items whole.

**Result.** Not changed by card E9.4, as the review asked; ADR 0034, decision 9 says the API still returns them all.

**Consequence.** A backlog row: withholding other grantees' grants at read is a read-path change, and touches what explanations name.
