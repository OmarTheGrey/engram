---
date: 2026-11-28
author: claude-agent
type: decision
card: D5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/promote.test.ts
  - packages/server/src/contract.ts
supersedes: none
---

**What.** No surface takes a release: `engram promote`, the server's promote route, MCP and pi carry no `release`, and `make api` is not run.

**Why.** A release matters only beside a replay, and ADR 0046's decision 7 keeps `replay` off every surface until verified actors exist; a release flag alone could never land a held procedure.

**Result.** The surfaces show the scan's findings: the CLI prints the reason (tested under report and hold), and the TUI promote screen has frames of a held answer.

**Consequence.** When replay reaches a surface, the release reason goes beside it in the same pull request.
