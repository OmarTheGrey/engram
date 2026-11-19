---
date: 2026-11-20
author: claude-agent
type: failure
card: E2.6
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** Finding V4-6: a Claude Code memory file the plane cannot delete is adopted again, under the erased id and with the erased text, once one line is appended, and Claude Code appends to these files routinely.

**Why.** ADR 0010's rule adopts a left-in-store record again once its content changes in any way.

**Result.** The rule is unchanged; the case is an open question for the lead in ADR 0010.

**Consequence.** The lead decides whether such a record is adopted only under a fresh id, or only without the erased lines.
