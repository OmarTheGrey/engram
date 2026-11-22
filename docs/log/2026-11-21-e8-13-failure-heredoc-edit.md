---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/connect.ts
supersedes: none
---

**What.** A multi-line edit of the CLI sources passed to Python through a Bash heredoc failed with `unexpected EOF while looking for matching quote`.

**Why.** The heredoc body held backticks and quotes, as the agent brief warns.

**Result.** Nothing was changed (`git status` was clean afterwards). The same edit ran from a script file with `python -I`.

**Consequence.** Edits go through files, never heredocs.
