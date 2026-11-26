---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/actor.ts
  - packages/cli/src/tui/forms.ts
  - packages/cli/test/tui/rerun.test.ts
supersedes: docs/log/2026-11-23-e8-15c-decision-actor-scoped.md
---

**What.** r runs the command line that ran, exactly, on every screen that has it; after a change of actor only `--owner`, `--as`, `--level` and `--member` become the workspace's. An actor is its id, its level and its memberships, sorted: the same principal with other memberships is another actor, whose answers no screen draws.

**Why.** The lead's decisions on N1 and N3. The superseded entry said r rebuilds the line from the workspace, which ran on another log (failure-n1-rerun), and compared actors by id alone, so dana without team:core still saw the team item.

**Result.** `rerun.test.ts` (7) and the N3 case of `actor-switch.test.ts`. Mutations: comparing by id alone fails it.

**Consequence.** The help text stays true: r runs again with the same flags.
