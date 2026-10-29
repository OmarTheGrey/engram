---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
supersedes: none
---

**What.** Two failures in the fix pass: a doc comment quoting the glob `memor*/a.md` ended the comment at `*/` and broke compilation, and several inline Python edits were refused by the worktree shell guard.

**Why.** A glob followed by a slash is a block-comment terminator; the guard refuses shell commands it cannot prove stay in the worktree.

**Result.** The comment spells the glob with `?`; edits moved to the Edit and Write tools and script files.

**Consequence.** Globs in comments are written without `*/`.
