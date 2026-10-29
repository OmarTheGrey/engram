---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/no-bypass-posix.test.ts
  - packages/core/src/no-bypass.ts
  - packages/mcp/test/hook.test.ts
supersedes: none
---

**What.** Windows-only test assumption, caught by Linux CI: the hook test `PowerShell Get-Content memory\a.md` passed on the Windows build machine and failed on CI's Linux, because the check resolved the word with the platform's path module, where only Windows reads `\` as a separator.

**Why.** PowerShell and cmd read a backslash as a path separator on every platform, so on Linux pwsh this was a real bypass; the Windows path module hid it, and no test ran the check with posix paths.

**Result.** The shell check now takes the shell's flavour: PowerShell and cmd words, and their nested scripts, normalise `\` to `/`; bash keeps it as an escape. `no-bypass-posix.test.ts` runs the check with `node:path` replaced by its posix half on every platform; without the fix its PowerShell case fails on Windows too.

**Consequence.** Path checks get a posix-path test beside the native one.
