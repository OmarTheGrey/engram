---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/format.ts
  - packages/cli/src/registry.ts
  - docs/tasks/E8.15.md
supersedes: none
---

**What.** Two files outside the card's list were changed: `packages/cli/src/format.ts` exports `policyName` and `outcomeText`, unchanged, and `packages/cli/src/registry.ts` names PATH and PATHEXT on the `tui` entry's environment.

**Why.** The card names `packages/cli/src/tui/screens/`, `snippets.ts` and the tests. Simulate's screen shows a changed step's outcome in the CLI's own words, which those two functions write, so a copy in the TUI could drift; and registry.test.ts requires every variable the CLI reads to be named on an entry, and snippets.ts reads PATH and PATHEXT. Neither change alters an output.

**Result.** The help snapshot and the registry tests pass; the card's status line names both files.

**Consequence.** Review finding E8.15d-13 is answered by this entry.
