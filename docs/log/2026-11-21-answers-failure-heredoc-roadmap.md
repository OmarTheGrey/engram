---
date: 2026-11-21
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/roadmap.md
supersedes: none
---

**What.** The roadmap's edits, first sent as a Python heredoc in a Bash call, failed to parse, and the script then rerun from a file still held a kill-list draft that re-listed E8.9's simulator, which item 26 records as done.

**Why.** The text held both quote kinds, which the shell's heredoc did not survive (the brief warns of it); the draft was written before item 26's "items 1 and 3 are done" was weighed.

**Result.** Bash reported "unexpected EOF while looking for matching quote" and nothing was written; the second run wrote the draft, and an edit removed E8.9 from it before the commit, leaving B9, E8.10 and D4.

**Consequence.** Edits with quotes go through script files only, and the draft was reread against item 26 before committing.
