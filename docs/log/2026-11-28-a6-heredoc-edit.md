---
date: 2026-11-28
author: claude-agent
type: failure
card: A6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/mcp-memory/index.ts
supersedes: none
---

**What.** A Bash heredoc carrying a Python edit script with backticks failed to parse, and no edit was applied.

**Why.** The brief's known pitfall: heredocs with quotes or backticks break in this shell.

**Result.** The edits were redone with the Edit tool; nothing was half-applied.

**Consequence.** Nothing.
