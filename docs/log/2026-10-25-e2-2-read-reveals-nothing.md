---
date: 2026-10-25
author: claude-agent
type: change
card: E2.2
chapter: implementation
pillar: plane
hypothesis: H1
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/test/unit/plane/read.test.ts
  - packages/core/test/property/read-leak.test.ts
  - docs/decisions/0009-retrieval-explanations.md
  - "pnpm exec vitest run packages/core/test/property/read-leak.test.ts"
supersedes: docs/log/2026-10-25-e2-2-read-path.md
---

**What.** Replaces the read path described in the card E2.2 entry: candidates are now only the items the reader can reach, and what the reader gets no longer counts the rest.

**Why.** Review finding R5-1 and decision D5: searching every scope and ranking relevance over all hits, and counting other teams' items as `filtered`, told a reader how many hidden items matched.

**Result.** The store is searched in reachable scopes only and relevance ranks among admitted items. The superseded entry's cross-scope result changes: the other team's item is no longer in `filtered` (0, not 1) but in the read event's reason, "1 projected item outside the reader's reach"; candidate and retired items are now counted as filtered. `explain` takes the reader. A property over 500 generated cases finds no difference when unreachable items are added.

**Consequence.** The E2.2 acceptance tests were changed to D5's counts.
