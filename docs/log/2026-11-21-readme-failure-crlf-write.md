---
date: 2026-11-21
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - specs/README.md
  - docs/compliance/README.md
  - docs/readings/README.md
  - packages/runner/README.md
supersedes: none
---

**What.** Three small edits made with a Python script left CRLF line ends in four files.

**Why.** Python's text mode on Windows translates each newline to CRLF when a file is written without `newline=""`, and the script used `Path.write_text` and `open(p, "w")`.

**Result.** Git warned on `git diff`; a byte count found carriage returns only in the files the script wrote. `sed -i 's/\r$//'` restored LF, and a second count found none in any file of this PR. `.gitattributes` (`eol=lf`) would have normalised them at commit, but the working copies differed from main's.

**Consequence.** Edits by script on this machine pass `newline=""` or use the Edit tool.
