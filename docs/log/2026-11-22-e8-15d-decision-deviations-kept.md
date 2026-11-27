---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/machine.ts
  - packages/cli/src/tui/screens/policy.ts
supersedes: none
---

**What.** Three departures from docs/design/tui.md that review finding E8.15d-12 named are kept: Doctor's checks appear together when doctor ends, not row by row (the command row says "working" meanwhile); Simulate draws one column at every width, with "differs" beside each row at 120 columns, not the two boxes of the wide mockup; enter on a lint finding opens its evidence, not the item page.

**Why.** Doctor runs as the plain command, whose output comes at its end; the boxes add no field the column lacks; the item page is card E8.15c's screen, not on this branch.

**Result.** The other deviations it named are fixed: Host is a choice, the Viewer and Retain's scope start as the actor, a `--host` refusal focuses Host, the HTTP port has its own hint, MCP's Try it line names its actor.

**Consequence.** After the merge, lint's enter can open the item page.
