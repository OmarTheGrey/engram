---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/check.test.ts
  - packages/cli/test/events.test.ts
  - packages/cli/test/policy.test.ts
  - packages/cli/test/grants.test.ts
  - packages/cli/test/scopes.test.ts
supersedes: none
---

**What.** Six commands, each one client call over a route main already has: `engram check`, `events`, `policy`, `grants`, `scopes` and `read --item <id>`.

**Why.** docs/design/tui.md 3.6 and 14 item 3: the inspector's routes needed plain commands so every TUI action is one, and E8.14 merged into this branch with `/scopes` and `/read/{itemId}`.

**Result.** check 4, events 4, policy 4, grants 4, scopes and read --item 5 tests pass, each with its request counted through `Io.transport`. `engram policy` prints YAML that `parsePolicy` loads back to each preset exactly. Mutation: check calling `/items` fails 3 of its tests.

**Consequence.** Their HELP lines, README rows and AGENTS.md lines are in; no route, schema or core change.
