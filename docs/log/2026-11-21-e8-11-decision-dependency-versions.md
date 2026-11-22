---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/deps.md
  - packages/ui/package.json
supersedes: none
---

**What.** dagre is `@dagrejs/dagre` 3.1.3, and TanStack Table is version 9.3.1.

**Why.** The card names dagre and TanStack Table without versions; `dagre` 0.8.5 dates from 2019 and is unmaintained, and Table 9 has been stable since August 2026.

**Result.** Every package and each transitive one was published on or before 2026-11-03, at least 18 days old; @xyflow/react is the card's 12.12.1. Licences MIT, ISC and BSD-3-Clause.

**Consequence.** If wrong, Table 8 would need a rewrite of EventTable.tsx's column and state code only.
