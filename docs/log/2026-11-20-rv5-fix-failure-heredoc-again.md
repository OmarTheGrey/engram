---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/transports.ts
supersedes: none
---

**What.** A Bash heredoc carrying a Python edit script with backticks and quotes failed (`unexpected EOF while looking for matching`), so no edit applied.

**Why.** The brief's known pitfall: heredocs with quotes or backticks break on this machine.

**Result.** The script was written with the Write tool to the scratchpad and run with `python -I`; the edits applied.

**Consequence.** None beyond the fix.
