---
date: 2026-11-25
author: claude-agent
type: change
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/core/src/plane/read.ts
  - packages/core/test/counterexamples/read-disclosure.test.ts
  - packages/server/test/read-disclosure.test.ts
  - packages/cli/test/read-disclosure.test.ts
  - packages/mcp/test/read-disclosure.test.ts
supersedes: none
---

**What.** One rule in core, `disclosedItem` in `visible.ts`, narrows the grants and lineage ids of every item core hands an actor: read, by-id read, explain's stored `grants_used`, `visibleEvents`, `Plane.promote`, `Plane.export` and the supersede route.

**Why.** Lead-decisions item 36 (a non-owner sees only the grants naming them) and card E8.15c's finding that `read --json` names lineage ids the reader may not read.

**Result.** The owner sees every grant, anyone else only those naming it; a lineage id is kept only under ADR 0047's by-id rule. `make test-one T=packages/core/test/counterexamples/read-disclosure.test.ts`: 12 passed; server 4, CLI 1, MCP 2 passed; each of four mutations of the rule fails 1 to 16 of them.

**Consequence.** The CLI, HTTP API, MCP and the inspector agree; the log keeps every grant and id.
