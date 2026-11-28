---
date: 2026-11-28
author: claude-agent
type: change
card: E9.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
  - packages/cli/test/doctor-discover.test.ts
  - packages/cli/src/tui/screens/machine.ts
supersedes: none
---

**What.** Doctor's `harness memory` check, before `serve`: ok when nothing is outside, else `warn` naming the counts per harness and kind. Doctor's status gains `warn`, its summary `, N warning(s)`, its JSON `warned`; the exit code counts failures only. The TUI's Doctor screen parses `warn`, draws it after failures, and gives its meaning and what to do.

**Why.** The card's fourth step: a warning, never a failure.

**Result.** `doctor --root <auto memory>` on the fake home: `warn harness memory  10 harness memory files outside every store root (...)`, `doctor: all checks passed, 1 warning`, exit 0. Mutation killed: `warn` made `fail` fails both doctor tests.

**Consequence.** Doctor run in this repository warns (its own CLAUDE.md and AGENTS.md).
