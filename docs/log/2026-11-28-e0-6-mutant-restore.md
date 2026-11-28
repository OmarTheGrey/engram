---
date: 2026-11-28
author: claude-agent
type: failure
card: E0.6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/check-absorbed.ts
supersedes: none
---

**What.** After the first mutation check, `git checkout` did not restore `scripts/check-absorbed.ts`.

**Why.** The file was still untracked, so checkout had nothing to restore and the mutant stayed in place.

**Result.** The file was restored from the copy taken before mutating, confirmed by grep, and the second mutant's run and restore ended with all six tests passing.

**Consequence.** A mutant of an uncommitted file is restored from a copy, never from git.
