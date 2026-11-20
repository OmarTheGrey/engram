---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass-posix.test.ts
  - docs/decisions/0014-no-bypass.md
supersedes: none
---

**What.** Review finding RV7-R3: the `cd` and `-C` following was easy to get past, in both shell modes. Each of these passed: `cd -- ..`; a quoted or escaped `cd` (`\cd`, `"cd"`, `c''d`); `Push-Location ..`; `make -C..` and `tar -C..` with the folder attached; `env --chdir=..`; and `bash -c -m 'cd ..; ...'`, because the message strip removed a real script.

**Why.** My patterns matched only the plain spellings. The `-m` strip ran wherever `-m '...'` appeared.

**Result.** All are blocked now, in posix and powershell mode, and single-quoted commit messages are still set aside. Mutation checks: removing each spelling fails its tests (`--`, quoted names, `push-location`, attached `-C`, `--chdir`, the strip gated to git, hg, svn, jj or bzr).

**Consequence.** ADR 0014 lists what stays open: `cd $D`, `cd "$(...)"`, `cd -`, `os.chdir`, `process.chdir` and `xargs`.
