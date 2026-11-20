---
date: 2026-11-20
author: claude-agent
type: decision
card: RV5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/src/extension.ts
  - packages/pi-extension/test/attacks.test.ts
supersedes: none
---

**What.** Each protectBelow folder is itself guarded, by handing core its parent as the folder below which a protected path's ancestors count, except the session's own cwd.

**Why.** The review asked for the folder itself to count without touching core's no-bypass.ts (card RV7). Guarding the cwd would block pi's `ls`, `grep` and `find`, which default to it, and every `.`; a relative path is already read against the cwd, so `cd` to it gains nothing.

**Result.** `cd "<base>" && rm engram.db`, `rm -rf` of it and `ls` of it are blocked; in the cwd, `ls`, `ls .` and `ls <cwd>` run and `rm -rf .pi` is blocked. A mutant for each half turns one case red.

**Consequence.** With pi-package's `[cwd, home]`, a command naming the home folder itself (`ls ~`) is now blocked; RV7's `cd` tracking may let this narrow again.
