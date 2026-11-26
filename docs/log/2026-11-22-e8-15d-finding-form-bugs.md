---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/forms.ts
  - packages/cli/src/tui/screens/setup.ts
  - packages/cli/test/tui/flows-surfaces.test.ts
supersedes: none
---

**What.** Two faults of E8.15b's generated form: its validation handed `log verify` the word `verify` as a positional, so every Log verify run was refused with "Unexpected argument 'verify'"; and its command line drops the hook's `--root` when a server is named, since `--root` is a workspace flag a server refuses for other commands.

**Why.** Found by the Log verify flow and while writing the hook screen.

**Result.** `Form.validate` now hands a command whose handler takes no positionals the words after its whole name (one line in forms.ts); the hook screen adds its roots back with a server. The flow test runs Log verify to its verdict.

**Consequence.** The generated form of any other multi-word command without positionals is fixed by the same line.
