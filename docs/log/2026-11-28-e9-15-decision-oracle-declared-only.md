---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.15
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/audit/report.ts
  - packages/cli/src/audit.ts
  - packages/core/src/dogfood.ts
supersedes: docs/log/2026-11-28-e9-15-finding-oracle-memberships.md
---

**What.** The orchestrator's decision on review finding 1: the oracle count is null unless actors are declared (`--declare <file>`, a JSON array of actors as core's `ActorShape` takes them, on both commands); when declared, the statement carries the count, the number declared and the set's sha256 (sorted by id, memberships sorted, canonical JSON).

**Why.** The log records no memberships, so an undeclared reader is judged by its own scope and a legitimate read through a team is signed as a violation; an auditor keeps the number, not the note.

**Result.** The count is read from the dogfood report's new structured `violations` (seq and kind), not its text (finding 8); `dogfood.ts` gains that field only, its report bytes unchanged (dogfood-report test 51 passed).

**Consequence.** Verify needs the same declared set; a different one fails at counts.
