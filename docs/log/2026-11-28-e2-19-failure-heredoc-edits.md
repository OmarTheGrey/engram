---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/test/unit/policy/load-options.test.ts
supersedes: none
---

**What.** Three scripted edits failed before writing anything: a Bash heredoc holding template literals ended early, and two Python edits passed through a heredoc did not match text holding a backslash escape.

**Why.** Git Bash on this machine treats backticks and backslashes in heredocs unreliably, as the brief warns.

**Result.** Each was redone with the Edit tool or a Python file written with the Write tool; the assertions in the scripts caught every mismatch, so no file was half edited.

**Consequence.** Edits with backticks or backslashes go through files, never heredocs.
