---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/parity.test.ts
supersedes: none
---

**What.** Each parity case names the plain command lines its action means, without the workspace's flags; the TUI's command lines, parsed by the handlers' own parse, must equal them with the workspace's flags added.

**Why.** Review finding 6: replaying the TUI's own argv on the plain side proved the bytes, not that the TUI ran the right command; an extra flag survived.

**Result.** 19 parity cases (12 in process, 7 against a server). Mutation: `--confidence 0.5` appended to writes fails 2 tests.

**Consequence.** E8.15d's parity can use the same MEANS table.
