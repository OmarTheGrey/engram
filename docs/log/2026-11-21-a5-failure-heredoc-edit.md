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

**What.** The first attempt to edit the conformance suite, a Python script passed through a Bash heredoc, failed before running with "unexpected EOF while looking for matching quote".

**Why.** The replacement text held backticks and quotes that the heredoc did not keep literal, the pitfall the absorb brief names.

**Result.** The script was written to a file with the Write tool and run with `python -I`; nothing in the repository had changed.

**Consequence.** Multi-line edits go through a script file.
