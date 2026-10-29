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

**What.** Finding R3-26: the commit-message exemption is granted in a nested script only when every enclosing script argument was wholly single-quoted, never inside a decoded PowerShell command, and never in a command holding a heredoc with an unquoted delimiter.

**Why.** An outer double-quoted script or an expanding heredoc body runs substitutions inside a single-quoted message before the inner shell reads it.

**Result.** Blocked in `packages/core/test/unit/no-bypass.test.ts`: the four forms the verifier confirmed, a `<<-EOF` body, and `bash -c "git commit -m 'memory leak'"` (the cost). Passing: `bash -c 'git commit -m "x"'`, `git commit -m 'fix memory leak'`, a quoted `<<'EOF'` heredoc. Mutants: the heredoc rule dropped fails 3 tests, the enclosing-quotes rule dropped 3.

**Consequence.** ADR 0014's amendment states where an outer shell withholds the exemption.
