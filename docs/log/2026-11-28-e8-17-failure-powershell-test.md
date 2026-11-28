---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/codex-hook.test.ts
supersedes: none
---

**What.** A test claiming Claude Code's POSIX reading lets `type memory\a.md` through failed: core blocks it under both readings.

**Why.** The test was meant to show what Codex's second reading adds.

**Result.** Replaced by a test of what Codex's reading does add: a patch into `memory/` that Claude Code's reading of the same call lets through.

**Consequence.** Decision both-shell-readings records that no killing spelling exists today.
