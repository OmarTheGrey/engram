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
  - packages/cli/test/tui/line.test.ts
supersedes: none
---

**What.** In line mode an answer of quit or exit, at any question, leaves; a typed command line the CLI refuses is shown, prints the plain CLI's output and is recorded with exit 2.

**Why.** Review E-4 and E-3: a person at a yes or no question had no way out but an answer, and a refused line lost the CLI's did you mean line and its exit code.

**Result.** The cost: quit or exit cannot be a prompted field's value; a whole typed command line still takes it, such as write --content quit.

**Consequence.** The help line says so.
