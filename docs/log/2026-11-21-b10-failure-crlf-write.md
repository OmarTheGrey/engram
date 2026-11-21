---
date: 2026-11-21
author: claude-agent
type: failure
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/cached.ts
supersedes: none
---

**What.** A Python edit script rewrote `packages/model/src/cached.ts` with Windows line endings.

**Why.** Text-mode writes on Windows translate newlines to CRLF, and the repository stores LF.

**Result.** Git warned that CRLF would be replaced; the file was converted back to LF before any commit, and later edits wrote bytes.

**Consequence.** Edit scripts on this machine write bytes, not text.
