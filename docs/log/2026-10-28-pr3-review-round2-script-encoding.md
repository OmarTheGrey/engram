---
date: 2026-10-28
author: claude-agent
type: failure
card: A4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - fixtures/stores/conformance-corpus.json
  - "python -I <script> fixtures/stores/conformance-corpus.json"
supersedes: none
---

**What.** Two helper scripts failed on Windows text encoding during round 2: a corpus edit piped through a Bash heredoc, and the mutation runner's progress output.

**Why.** Python read the heredoc and wrote to the console in the cp1252 code page, so the corpus line with an emoji did not match, and printing vitest's box-drawing characters raised UnicodeEncodeError; `-I` also ignores PYTHONIOENCODING.

**Result.** The corpus edit was redone from a UTF-8 script file, and the runner now sets UTF-8 on stdout. The runner restored each mutated file in a `finally`, so no mutant was left behind; `git status` confirmed it.

**Consequence.** Helper scripts on this machine are written to files and set UTF-8 output themselves.
