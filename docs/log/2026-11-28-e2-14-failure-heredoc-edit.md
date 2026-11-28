---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/schema.ts
supersedes: none
---

**What.** The first attempt to edit `schema.ts`, a Python script written through a Bash heredoc, failed before running: the shell stopped at an unmatched quote.

**Why.** The script held backticks and quotes, which the brief warns break heredocs on this machine.

**Result.** Nothing was written (`git status` showed only the new test file); the edits were made with the editor tool instead.

**Consequence.** Nothing; the brief's advice holds.
