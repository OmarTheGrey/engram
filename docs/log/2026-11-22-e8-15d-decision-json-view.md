---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15d
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/surface.ts
  - packages/cli/test/tui/parity.test.ts
supersedes: none
---

**What.** J shows, for retain, lint and simulate, the answer of the call already made, printed as the command prints `--json` (`JSON.stringify(body, null, 2)`); for doctor, key list and log verify, which change nothing, a second run with `--json`; and nothing, with the reason said, for export (it has no `--json`), import (a second run would import again) and key create (it would create another key).

**Why.** docs/design/tui.md 3.8 asks for the exact `--json` bytes; a second retain or lint would sweep or append events again.

**Result.** parity.test.ts checks J against the plain `--json` run on a twin workspace for the six screens that offer it.

**Consequence.** Import's JSON is reached in a shell; a later card could build it from the calls if the CLI exposed its print.
