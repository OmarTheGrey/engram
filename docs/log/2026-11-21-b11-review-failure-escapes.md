---
date: 2026-11-21
author: claude-agent
type: failure
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/tau2_engram.py
supersedes: none
---

**What.** A Python edit script for the driver failed twice to match its target.

**Why.** The script was written through a Bash heredoc. The Bash tool turned each `\\n` into `\n`, so the target text held real newlines where the file holds escaped ones.

**Result.** The script's assertion stopped it before any change. Each edit was then made with the Edit tool.

**Consequence.** Edits to text that holds escapes are made with the Edit tool only.
