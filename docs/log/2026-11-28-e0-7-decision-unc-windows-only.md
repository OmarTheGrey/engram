---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.7
chapter: design
pillar: research
hypothesis: none
evidence:
  - scripts/test/offline-guard.ts
  - scripts/test/offline-guard.test.ts
supersedes: none
---

**What.** A path that starts with two slashes or backslashes, other than the local device prefixes `\\.\` and `\\?\`, is remote only on Windows.

**Why.** Windows reads such a path as UNC and reaches the named host over SMB; on Linux and macOS `//x` is an ordinary local path and a backslash is a file-name character.

**Result.** The UNC test runs on Windows only; the local pipe and Unix socket test runs everywhere.

**Consequence.** None for CI on Linux, which has no UNC.
