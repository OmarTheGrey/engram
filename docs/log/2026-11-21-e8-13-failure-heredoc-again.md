---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/export/otel.ts
supersedes: none
---

**What.** In the review fix pass, a quoted Bash heredoc (`<<'PYEOF'`) carrying the fix script failed with `unexpected EOF while looking for matching quote`.

**Why.** The script held backticks and template literals; on this machine even a quoted heredoc breaks on them, as the agent brief warns.

**Result.** Nothing was changed (`git status` showed only the test file edited before). The script was written with the Write tool and run with `python -I`.

**Consequence.** As the earlier heredoc failure concluded: scripts go in files.
