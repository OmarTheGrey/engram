---
date: 2026-11-21
author: claude-agent
type: failure
card: B7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/merit/env.ts
supersedes: none
---

**What.** A Python edit run from a Bash heredoc wrote `"\n"` in TypeScript string literals as real line breaks, breaking `env.ts`.

**Why.** The brief warns that heredocs with quotes and backslashes break on this machine.

**Result.** Seen before tsc ran; the file was rebuilt from a fragment written with the Write tool.

**Consequence.** TypeScript text goes through the Write tool, never a heredoc.
