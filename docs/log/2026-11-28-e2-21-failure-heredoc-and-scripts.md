---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.21
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** Three tool failures on the way, none in the code.

**Why.** Logged as the lead asks.

**Result.** A Bash heredoc holding backticks failed to parse, so the first edit script never ran; the edits were rewritten as a Python file. The mutation script decoded vitest's output as cp1252 and crashed on its box characters; it was rerun with UTF-8 (`-X utf8`). The audit script was first started without its required `--out` and exited 2 at once. One test expectation was wrong: a grant from 1 January 2028 to 31 December 2028 is exactly 365 days in a leap year, so it lands; the test now pins that and one second more.

**Consequence.** Nothing in the change; the scripts stayed in the scratchpad.
