---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/src/tui/screens/surface.ts
  - packages/cli/src/tui/screens/policy.ts
  - packages/cli/test/tui/actor-switch.test.ts
  - packages/cli/test/tui/flows-surfaces.test.ts
  - docs/tasks/E8.15.md
supersedes: none
---

**What.** `origin/cliupgrade` (E8.15c) merged into `cliupgrade-d` by the review's section 5 map, and E8.15d's screens fitted around it.

**Why.** The coordinator's change of plan: the merged suite is where the AST guard's finding shows.

**Result.** E8.15d's screens draw no answer made as another actor, and join actor-switch.test.ts (Retain, Lint, Export through both switches; Simulate still drawn). `r` reruns the same command line, taking only the actor flags from the workspace when the answer was another actor's, never a chosen `--db` or `--root`. Lint's enter opens the item page, space its evidence. J of doctor, key list and log verify is a peek. policy.ts draws rules and reasons only in templates and `oneLine`. Try it's failure text gives both Claude Code behaviours, before and from v2.1.295. A slow Try it child dies on quit. The card names `parity-surfaces.test.ts`.

**Consequence.** One more merge when E8.15c's fix lands.
