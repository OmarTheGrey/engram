---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0037-absorbing-open-source.md
  - docs/absorbed.md
supersedes: none
---

**What.** ADR 0037 item 8 wants `make lint-docs` to fail when `docs/absorbed.md` names a missing file, implemented by the first card that adds a row. This card adds four rows and does not implement the check.

**Why.** Card E2.9 adds rows at the same time, and two parallel versions of one check in `scripts/` would conflict; it is outside this card's files.

**Result.** Every path the four rows name exists.

**Consequence.** The orchestrator assigns the check to one card.
