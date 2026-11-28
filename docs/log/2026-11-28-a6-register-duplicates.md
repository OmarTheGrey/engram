---
date: 2026-11-28
author: claude-agent
type: finding
card: A6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/absorbed.md
supersedes: none
---

**What.** `docs/absorbed.md` on main holds four rows twice (L6's graphiti, gaptime and remnic rows, and L5's claude-mem and codebase-memory-mcp rows).

**Why.** Seen while appending this card's row; the check passes duplicates.

**Result.** Left as they are: removing another card's rows is outside this card.

**Consequence.** For the orchestrator: drop the second copies when it next touches the register.
