---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ai-sdk/test/conformance.test.ts
  - "make api-check"
supersedes: none
---

**What.** Small failures on the way: API timeouts cut the agent's session three times, a Python edit wrote CRLF line endings, a shell-quoted edit put a literal newline in a string, and `make api-check` failed once.

**Why.** Long tool output stalled the stream; Python's text mode on Windows writes CRLF; a backslash escape passed through two quoting layers; the regenerated files were not yet committed when `make api-check` compared them.

**Result.** Work was committed step by step, so nothing was lost. The CRLF was stripped before commit, the string was fixed with the Edit tool (the test then passed 4 of 4), and `make api-check` passed after the commit.

**Consequence.** Later edits write with `newline=""` or the Edit tool.
