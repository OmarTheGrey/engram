---
date: 2026-10-29
author: claude-agent
type: failure
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

**What.** The R3-15 rule, which checked only path-like words inside a quoted argument, reopened literal bypasses that named a root inside a quoted script: `eval "cd memory && cat a.md"`, `bash <<< "..."`, `echo "..." | bash`, `bash -c -- "..."`, `iex "..."`, `python -c "...chdir('memory')"`, `node -e "..."`.

**Why.** The rule was made to let a commit message through, but a quoted string is a script in many places besides `bash -c`, so exempting quoted strings in general erred towards allowing, against ADR 0014's stated direction.

**Result.** Found by the final verification. Every quoted word is checked again; only version-control message arguments are exempt (R3-16). Each listed command is a blocked test case; restoring the R3-15 filter fails 9 tests.

**Consequence.** `grep -rn "memory leak" src` is refused again, which ADR 0014 lists as a kept cost.
