---
date: 2026-10-29
author: claude-agent
type: change
card: E8.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read-reason.ts
  - packages/core/test/property/read-reason.test.ts
  - packages/server/src/routes.ts
  - packages/ui/src/view.ts
  - test/e2e/inspector.e2e.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** Card E8.6: the explain view of a read, and the core parser of the read event's reason beside the function that writes it.

**Why.** The card asks which items a read returned and which were filtered by which rule; decision 5 puts the parsing in core so no surface parses the reason by hand.

**Result.** `formatReadReason` writes the reason, `parseReadReason` and `readCounts` read it back; a property test round-trips 1000 generated count sets. The explain route returns `counts` beside the explanations. In Chromium the fixture read shows four rows (rank, score components, admitting rule, grants used, validity) and 6 filtered (3, 2, 1 and 0 by category), equal to the event's counts and the read's `filtered`. A parser swapping two categories fails the property and e2e tests.

**Consequence.** None for other cards; the reason's wording can change only with its parser.
