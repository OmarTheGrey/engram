---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - docs/decisions/0004-provenance-and-source-trust.md
supersedes: none
---

**What.** Two edit scripts went wrong: a Bash heredoc holding a Python edit script was cut short, and a Python script run on Windows wrote six ADRs back with CRLF line endings.

**Why.** The heredoc's quotes and backticks broke it (the pitfall the agent brief names); Python's text mode on Windows writes `\r\n`.

**Result.** The heredoc ran nothing (the working tree was clean after it), and the edits were made with the Edit tool. The ADRs were normalised to LF before any commit (`tr -cd '\r' | wc -c` gives 0 for each), and later scripts write bytes.

**Consequence.** Nothing reached a commit.
