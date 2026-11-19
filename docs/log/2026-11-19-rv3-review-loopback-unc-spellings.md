---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/src/no-bypass/paths.ts
  - packages/core/test/unit/no-bypass.test.ts
  - packages/mcp/test/hook.test.ts
  - packages/pi-extension/test/attacks.test.ts
supersedes: docs/log/2026-11-19-rv3-loopback-unc-spellings.md
---

**What.** The no-bypass check reads this machine's loopback UNC spellings as their drive paths, now also in the escaped form a posix shell is given (review fix pass, RV3-2).

**Why.** The first entry covered single-backslash spellings only; Git Bash needs `\\\\localhost\\C$\\x` to reach `\\localhost\C$\x`, and that text got past the check.

**Result.** In a shell command any run of separators now stands for one and an escaped `\$` for `$` (`UNC_WORD`, `asUncPath`). Tests with the escaped spelling for every loopback host fail on the old code and pass: core (bare, `\$` and double-quoted forms, from a cwd naming no root), the Claude Code hook and a real pi session. Run in Git Bash on a scratch store, the six spellings that reach it here are refused by the hook, as are the other two. Another host's escaped share stays allowed.

**Consequence.** ADR 0014's amendment of card RV3 says so.
