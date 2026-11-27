---
date: 2026-11-26
author: claude-agent
type: failure
card: X20
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/model/cassette.ts
supersedes: none
---

**What.** A Bash heredoc carrying a Python edit of `cassette.ts` failed with "unexpected EOF while looking for matching quote".

**Why.** The replacement text held backticks and quotes, the known pitfall of the brief.

**Result.** The edit ran from a script file in the scratchpad with `python -I`; nothing had been written.

**Consequence.** Every later multi-line edit went through a script file.
