---
date: 2026-11-07
author: claude-agent
type: failure
card: none
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - Makefile
  - "make run CONFIG=research/configs/b3-gatemem-plane.json"
supersedes: none
---

**What.** On Windows, `make bench BENCH=gatemem` and `make run` failed when started from PowerShell, with `'ENGRAM_OFFLINE' is not recognized as an internal or external command`.

**Why.** The GNU make for Windows that was installed (ezwinports 4.4.1, through scoop) runs recipes in `cmd.exe` when no `sh` is on the PATH, so the Makefile's POSIX recipes (inline variables, `{ ...; }` groups) break. `make test` and `make lint` only run single commands, so they passed.

**Result.** Started from Git Bash, which puts `sh` on the PATH, both targets pass.

**Consequence.** On Windows, run `make` from Git Bash.
