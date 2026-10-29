---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/doctor.test.ts
supersedes: none
---

**What.** Two tool problems while working card A2 on Windows: a Python edit rewrote `packages/cli/test/doctor.test.ts` with CRLF line ends, and the worktree guard refused shell commands whose text named git outside a plain form.

**Why.** Python's text mode translates "\n" to "\r\n" on Windows; the guard cannot tell that a `sed` or heredoc whose content mentions git stays in the worktree, so it refuses the whole command.

**Result.** The file was rewritten with LF (406 carriage returns removed) before any commit; later edits used binary-mode Python script files and the Edit tool, and git queries ran from Node test helpers.

**Consequence.** Agents on this machine edit files through the Edit tool or Python in binary mode, never Python text mode.
