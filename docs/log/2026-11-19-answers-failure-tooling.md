---
date: 2026-11-19
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_label_audit.py
supersedes: none
---

**What.** Two tooling slips on the way: a Bash heredoc holding a Python patch with quotes broke the shell, and a Python rewrite of the test file on Windows wrote CRLF line endings.

**Why.** The heredoc's nested quotes ended the string early, a known pitfall on this machine; `Path.write_text` translates newlines to the platform's.

**Result.** Nothing was changed by the broken command. The patch was written as a whole file instead, the test file was put back to LF before any commit, and later rewrites used bytes. `git diff` showed only the intended lines.

**Consequence.** Patches go through files written with the Write tool and byte writes.
