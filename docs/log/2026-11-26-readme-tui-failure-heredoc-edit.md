---
date: 2026-11-26
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/README.md
  - packages/mcp/README.md
supersedes: none
---

**What.** An edit of the server and MCP READMEs, sent as a Python script in a quoted bash heredoc, failed before it ran.

**Why.** The script held a triple-quoted Python string with backticks and apostrophes, and the shell reported an unexpected end of file while looking for a matching quote, so no file was changed.

**Result.** The same replacements were written as script files in the session's scratch folder and run from there; both READMEs were edited and committed. A second, smaller slip: a Python text-mode write on Windows turned the root README's line ends into CRLF in the working tree only; git stored LF, and `sed -i 's/\r$//'` restored the working copy.

**Consequence.** Multi-line edits with mixed quotes go through a script file, not an inline heredoc, and Python writes pass `newline=''`.
