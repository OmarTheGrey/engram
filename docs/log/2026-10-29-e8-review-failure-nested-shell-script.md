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

**What.** The first fix for review finding R3-15 (a quoted argument is one word) let `bash -c "cd memory && cat a.md"` through: the script was read as a quoted argument, and only its path-like inner words were checked.

**Why.** The fix treated every quoted string alike, but decision D10 says what runs inside `bash -c` and `sh -c` is checked like the rest of the command; the tests had a commit message and a path-like `bash -c` case, not a script that reaches a root by `cd`.

**Result.** Found by the coordinator's check of the R3-15 fix. A shell's script argument (sh-family `-c`, PowerShell `-c` or `-Command`, `cmd /c`) is now checked recursively as a nested command; eight new cases are blocked and three non-script quoted arguments still pass. Disabling the nesting fails 6 tests.

**Consequence.** ADR 0014's amendment no longer lists the case as passing.
