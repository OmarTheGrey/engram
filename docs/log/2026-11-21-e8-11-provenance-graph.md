---
date: 2026-11-21
author: claude-agent
type: change
card: E8.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/ui/src/provenance.ts
  - packages/ui/src/ProvenanceGraph.tsx
  - packages/ui/src/layout.ts
  - packages/ui/test/provenance.test.ts
  - packages/ui/test/layout.test.ts
  - test/e2e/item-page.e2e.test.ts
supersedes: none
---

**What.** An item's page in the inspector, at `#/item/<id>`, draws the item, the items its lineage links it to and the decision events about them as a graph, with xyflow at positions dagre computes.

**Why.** Lineage is a graph; card E8.11 makes every recall's provenance visible in a demonstration.

**Result.** Built from the viewer's read and events only, no new route. Nodes take the focus with a label; Enter, Space or a click shows a node beside the graph, and a list under it links every item. The page is a lazy chunk: the entry bundle holds no xyflow code, which the e2e test checks. `make test-e2e`: 45 tests passed.

**Consequence.** Editing from the graph stays out of scope.
