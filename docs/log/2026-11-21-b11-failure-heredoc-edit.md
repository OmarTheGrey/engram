---
date: 2026-11-21
author: claude-agent
type: failure
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/tau2_memory.py
supersedes: none
---

**What.** An edit script passed through a Bash heredoc failed to match its target in the shim.

**Why.** The brief's pitfall: the target held escaped newlines and quotes, which did not survive the heredoc as written.

**Result.** The script's assertion stopped it before any change to that file; the edit was made with the Edit tool instead.

**Consequence.** None.
