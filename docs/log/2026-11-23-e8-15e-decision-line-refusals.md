---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/main.ts
  - packages/cli/test/tui/line.test.ts
supersedes: none
---

**What.** Line mode keeps every refusal of 5.2 but TERM=dumb: no terminal on stdout or stdin, CI set, or --json still exit 2 with their line.

**Why.** Line mode writes no escape sequence, which is why the dumb refusal already says try engram tui --line; but it still reads a person's answers, so without a terminal, or in CI, there is nobody to answer.

**Result.** line.test.ts: each refusal row and TERM=dumb starting line mode, where screen then prints the dumb refusal and stays.

**Consequence.** None.
