---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/grants.ts
  - packages/ui/src/view.ts
supersedes: none
---

**What.** Two shell steps went wrong while working the card: a Bash heredoc carrying a Python edit of `packages/ui/src/view.ts` failed to parse, and during a mutation check `git checkout` did not restore `packages/core/src/plane/grants.ts`, which was not yet tracked.

**Why.** The heredoc held quotes the shell still matched, as the plan's brief warns; `git checkout` restores only tracked files.

**Result.** The edit was rerun from a script file written with the Write tool; the mutation was reverted by hand and checked (`grep` found the restored line, and the acceptance passed again before the commit).

**Consequence.** Later mutation checks copied the file aside and back.
