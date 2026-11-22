---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/decisions/0046-replay-validation-source.md
  - docs/decisions/README.md
  - scripts/test/tasks-and-decisions.test.ts
supersedes: docs/log/2026-11-21-d3-decision-validation-source-adr-0045.md
---

**What.** Card D3's ADR on the replay validation record's source is renumbered from 0045 to 0046. Its decisions are unchanged.

**Why.** Card D2 merges first, and its ADR, the AWM prompt adapted to tool use, now takes 0045. That keeps the decisions index consecutive at each merge.

**Result.** The ADR file is now `docs/decisions/0046-replay-validation-source.md`. Its title, the index row and prose, lead-decisions item 63 (which keeps its number), the code comments and the architecture sentence say 0046. `OWNER_DECIDES` holds 0045 (D2's) and 0046. Earlier entries' evidence paths point at the 0046 file, their bodies unchanged.

**Consequence.** The index's consecutive-numbers test passes once D2's renumbering is merged.
