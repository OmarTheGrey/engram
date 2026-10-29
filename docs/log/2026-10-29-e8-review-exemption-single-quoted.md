---
date: 2026-10-29
author: claude-agent
type: change
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass.test.ts
  - docs/decisions/0014-no-bypass.md
supersedes: none
---

**What.** The commit-message exemption is shrunk (findings R3-23 to R3-25): a message is exempt only when wholly single-quoted, the VCS tool is in command position, and its subcommand is a built-in that takes a message; an unquoted newline ends a segment; every word is also checked after its last colon, on the raw word.

**Why.** Single quotes never expand, so nothing in such a message can run; the verifier showed holes through newlines, aliases and `rev:path` forms.

**Result.** Blocked in `packages/core/test/unit/no-bypass.test.ts`: the reviewer's cases, a git word outside command position even single-quoted, and the double-quoted `git commit -m "fix memory leak"`; passing: the single-quoted forms, `git -C . commit -m 'memory: tidy'`. Mutants: the single-quote rule dropped fails 7 tests, the subcommand rule 3, the newline rule 1, the last-colon rule 3, command position 2.

**Consequence.** ADR 0014 says why an exempt message must be single-quoted.
