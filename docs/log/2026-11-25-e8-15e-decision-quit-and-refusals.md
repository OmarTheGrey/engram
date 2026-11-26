---
date: 2026-11-25
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/line.ts
  - packages/cli/src/tui/validate.ts
  - packages/cli/test/tui/line.test.ts
supersedes: docs/log/2026-11-25-e8-15e-decision-quit-anywhere.md
---

**What.** In line mode quit or exit leaves from any question. A typed line the CLI's parse or prepare refuses goes through run, which refuses it before opening anything, so its output and exit code are the CLI's and are recorded. A refusal from a check of the TUI's own, such as the store opened read only, is said as line mode's, runs nothing and records nothing.

**Why.** Review E-3 and E-4, and verification R-2: a write the plain CLI runs had been reported as refused with exit 2.

**Result.** A prompted field cannot take quit or exit; a typed command line can, and the help says so.

**Consequence.** None.
