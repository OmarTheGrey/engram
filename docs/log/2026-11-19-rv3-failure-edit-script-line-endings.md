---
date: 2026-11-19
author: claude-agent
type: failure
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/files/index.test.ts
supersedes: none
---

**What.** A Python script that removed the index tests from `packages/adapters/test/files/index.test.ts` wrote the file with CRLF line ends and one stray closing brace.

**Why.** On Windows, Python's text mode turns each `\n` into `\r\n` on write unless `newline=""` is given, and one cut kept the removed test's closing line. Shell heredocs carrying the script's quotes also broke twice, as the agent brief warns.

**Result.** Seen at once in git's line-ending warning; the file was restored from git, the script fixed (`newline=""` on read and write, the cut corrected) and run again. No damaged file was committed.

**Consequence.** Edit scripts for this repository open files with `newline=""`.
