---
date: 2026-11-21
author: claude-agent
type: failure
card: L5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/src/lint.ts
  - packages/core/src/lint/det.ts
supersedes: none
---

**What.** Python edits in text mode on Windows rewrote packages/core/src/lint.ts and lint/det.ts with CRLF line endings.

**Why.** Python translates newline to CRLF on Windows unless `newline=''` is given.

**Result.** `sed -i 's/\r$//'` restored LF before any commit; later edits pass `newline=''`.

**Consequence.** Nothing.
