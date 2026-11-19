---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** Review finding M7 of PR #44: ADR 0034 said a grant change is never an agent's, without saying that this holds only for agents going through MCP or pi.

**Why.** Until authentication exists the HTTP actor is self-asserted (ADR 0027), so any local process can post to `/grants` claiming to be a user.

**Result.** ADR 0034, decision 8 now says so.

**Consequence.** None beyond the existing authentication follow-up.
