---
date: 2026-11-28
author: claude-agent
type: failure
card: X17
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_results_page.py
supersedes: none
---

**What.** Two scripted edits did not apply: a Python replace inside a Bash heredoc silently matched nothing, and a second heredoc with quotes failed to parse.

**Why.** The heredoc turned the escaped newline in the search text into a different string, so `str.replace` found no match and reported nothing; the brief warns that heredocs with quotes break on this machine.

**Result.** The test still failed after the "fix", which exposed it. Every later scripted edit was written to a file with the Write tool and asserted that each search text occurs exactly once before replacing it.

**Consequence.** None for the code; the edit helpers in the scratch folder are not committed.
