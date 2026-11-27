---
date: 2026-11-28
author: claude-agent
type: failure
card: RD1
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - test/e2e/item-page.e2e.test.ts
  - packages/view/src/provenance.ts
  - packages/core/src/visible.ts
supersedes: none
---

**What.** The item-page e2e "shows sam, who cannot read the note, no node, edge or count that reveals it" failed in the orchestrator's run: on the team item's page it found no `lineage:TEAM>CHECKLIST` edge.

**Why.** It was not RD1 over-hiding. In process, sam's read, by-id read and events all give the checklist the lineage `[TEAM]`, with only the note dropped, which ADR 0047's rule and ADR 0034 decision 9 require. The graph's edges depend only on that lineage. The test read the edges once, right after the node count settled, and React Flow draws edges after it measures the nodes.

**Result.** Before: 2 of 11 full-file runs failed at line 365, and 5 runs of that test alone passed. The test now polls for the lineage edge, with the same expectation. After: 8 of 8 full-file runs passed (13 tests each). No code changed.

**Consequence.** Nothing further.
