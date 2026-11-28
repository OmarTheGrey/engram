---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.16
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - packages/core/src/plane/export.ts
supersedes: none
---

**What.** The report's closure and lists record no event of their own: they are part of the export's answer, covered by Plane.export's one read event, as RD1's narrowing of an answer is; a named derived item may show an empty `from` when every step to it is withheld.

**Why.** Review finding 5 asked for a decision line: each id named is one the subject could already ask for by id, under the rule visible.ts uses for a lineage pointer; a second event per export would also make the report depend on the exports before it. The empty `from` tells no more than the withheld count does (review finding 6).

**Result.** One export, one event; the report is the same for the same log.

**Consequence.** Putting the closure into Plane.export's answer would need a route change and make api, a later card's.
