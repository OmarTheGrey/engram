---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/run.ts
  - packages/cli/test/registry.test.ts
supersedes: none
---

**What.** HELP's first line names `engram tui`, and an unknown command or flag close to a known one gets a second stderr line, `engram: did you mean "read"?` or `engram read: did you mean --root?`.

**Why.** docs/design/tui.md 12.2 items 1 and 3.

**Result.** The registry test pins both lines byte for byte, and that a far typo (`frobnicate`, `--bogus`) adds nothing; exit codes stay 2 and stdout empty. Mutation: the command suggestion switched off fails its test.

**Consequence.** `engram tui` itself arrives in E8.15b; until then the first line names a command that answers as unknown.
