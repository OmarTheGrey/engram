---
date: 2026-11-28
author: claude-agent
type: failure
card: E0.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/offline-guard.test.ts
supersedes: none
---

**What.** The first UNC probes reached the test file with their backslashes halved, so the guard saw `\fileserverpipeengram`, a local path, and the test failed; before the fix the unguarded probe also spent 2.7 s on a real SMB attempt.

**Why.** Python string escapes inside a shell heredoc, twice over.

**Result.** The probes are now `String.raw` templates, and the test passes on Windows.

**Consequence.** Backslash-heavy probes are written as `String.raw` from the start.
