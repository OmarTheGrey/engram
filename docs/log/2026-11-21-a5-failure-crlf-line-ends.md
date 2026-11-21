---
date: 2026-11-21
author: claude-agent
type: failure
card: A5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/suite.ts
supersedes: none
---

**What.** The Python edit of the conformance suite rewrote every line of `suite.ts` with CRLF line ends, and git warned on the diff.

**Why.** Python on Windows opens a file in text mode with the platform's newline, so writing translated each LF to CRLF.

**Result.** The line ends were put back to LF with `sed`, and the later edit script writes with `newline="\n"`; the committed diff holds only the intended changes.

**Consequence.** Edit scripts on this machine pass `newline="\n"` when they write.
