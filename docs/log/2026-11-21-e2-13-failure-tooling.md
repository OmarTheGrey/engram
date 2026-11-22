---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - make lint
supersedes: none
---

**What.** Four tooling failures on the way. A Python edit script in text mode wrote CRLF line endings into plane.ts and the new test; a shell heredoc carrying JSX quotes broke; `make lint` found one biome format difference in who-can-read.ts after a later edit; and the session was cut by API timeouts twice, before anything was committed the first time.

**Why.** Windows text mode translates newlines; the brief warns about heredocs; biome had not been rerun after the last edit of that file.

**Result.** Line endings restored to LF before the first commit; edit scripts now open files with `newline=""` and are written with the Write tool; the formatter applied and `make lint` exits 0. After the timeouts each step was committed at once.

**Consequence.** None for the code.
