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

**What.** The commit-message exemption is narrowed (findings R3-19 to R3-22): the VCS name must be in command position, a message that expands anything outside single quotes is checked in full, and every word is also read as a path after its first colon.

**Why.** The verifier showed command substitution, a misplaced `git` word and `rev:path` forms each reaching the store through the exemption.

**Result.** In `packages/core/test/unit/no-bypass.test.ts`, the reviewer's nine cases and five more are blocked; `git commit -m "fix memory leak"`, `git commit -m 'memory: tidy'` and five wrapper or nested forms pass. Mutants: the exemption for every command fails 4 tests, command position dropped 3, the path check inside messages dropped 1, the expansion check dropped 6, the colon rule dropped 3.

**Consequence.** ADR 0014 adds `git log -p` and `git show` with no path to the enclosing-folder limit.
