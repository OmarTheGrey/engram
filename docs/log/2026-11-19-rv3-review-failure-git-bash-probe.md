---
date: 2026-11-19
author: claude-agent
type: failure
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
supersedes: none
---

**What.** Two missteps while confirming RV3-2 in Git Bash: a `git checkout` of `no-bypass.ts`, meant to stage the before run, discarded the uncommitted fix, and the first run showed no write reaching the store for any spelling.

**Why.** The fix was not yet committed when the file was checked out from HEAD. The empty first run came from passing the command to `bash.exe -c` as a Windows argument, whose quoting halves the backslashes, so bash saw `\localhost...`, not the text a Bash tool hands it.

**Result.** The fix was written again from the reviewed edit and the before state staged by copying files, never by checkout. Fed through stdin (`bash -s`), the command reached the scratch store for six of eight hosts before the fix, and the hook refused all eight after it.

**Consequence.** A probe that runs a shell command passes it on stdin.
