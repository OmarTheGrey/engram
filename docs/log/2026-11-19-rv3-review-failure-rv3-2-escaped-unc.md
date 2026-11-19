---
date: 2026-11-19
author: claude-agent
type: failure
card: RV3
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass.test.ts
  - packages/mcp/test/hook.test.ts
  - packages/pi-extension/test/attacks.test.ts
supersedes: none
---

**What.** Review finding RV3-2 (blocking): the escaped spelling of a loopback share in a posix shell command was not blocked, and in Git Bash it wrote into the store root, for every loopback host, `\\localhost` included, already on main.

**Why.** Git Bash, Claude Code's Bash tool on Windows, reads `\\` as one backslash, so the command text that reaches `\\localhost\C$\x` is `\\\\localhost\\C$\\x`. My tests used single-backslash spellings, which bash turns into `\localhost...`, so they never tested what the shell passes on.

**Result.** Run in Git Bash on a scratch store before the fix: six of eight spellings (`localhost`, `127.0.0.1`, `\\?\UNC\localhost`, `\\.\UNC\localhost`, `\\?\UNC\127.0.0.1`, `0--1.ipv6-literal.net`) wrote a file into the store and the hook allowed all eight; `127.1` and `[::1]` did not resolve on this machine. Fixed in the next entry.

**Consequence.** Shell tests now use the text a shell is given.
