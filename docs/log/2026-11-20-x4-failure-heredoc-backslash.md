---
date: 2026-11-20
author: claude-agent
type: failure
card: X4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - "SyntaxError: missing ) after argument list (node, a script written by a Bash heredoc)"
supersedes: none
---

**What.** A throwaway node script written through a Bash heredoc lost a backslash and failed to parse.

**Why.** The heredoc mangled the regular expression `/\\/g`, a pitfall the agent brief already names for heredocs with quotes or backticks.

**Result.** The script was rewritten with the file tool and ran. It was a viewing aid only, never committed.

**Consequence.** Nothing; the brief's advice to write files with the file tool stands.
