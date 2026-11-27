---
date: 2026-11-25
author: claude-agent
type: failure
card: E9.9
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - "make lint"
supersedes: none
---

**What.** The first mutation run rewrote promotion.ts and a test file with Windows line endings, and its report crashed on the console's encoding.

**Why.** Python on Windows translates newlines when writing text unless told not to, and `python -I` ignores PYTHONIOENCODING.

**Result.** Found by git's CRLF warning before any commit; the files were converted back to LF, and the script now writes with `newline=""` and reconfigures stdout to UTF-8. No committed file carried CRLF.

**Consequence.** Scripts that edit repository files on this machine open them with `newline=""`.
