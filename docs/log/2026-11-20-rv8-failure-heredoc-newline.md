---
date: 2026-11-20
author: claude-agent
type: failure
card: RV8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/label_audit_sample.py
supersedes: none
---

**What.** An edit script passed through a shell heredoc turned the two escaped newlines of the LongMemEval context's join into real ones, and label_audit_sample.py failed to import (unterminated string).

**Why.** The brief's known pitfall: heredocs with quotes and escapes break on this machine.

**Result.** Fixed by hand with the Edit tool; a second heredoc, appending tests, failed on a quote and was replaced by a file written with the Write tool.

**Consequence.** Further edits use the Write and Edit tools.
