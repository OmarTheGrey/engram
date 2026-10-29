---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - test/e2e/inspector.e2e.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** The first e2e step for review R4-4 failed with the fix in place: it saw the old event detail after switching the viewer.

**Why.** The step waited for the new viewer's name and then for a timeline row. React renders the new viewer's name one render before the inspection resets, so the wait matched the previous viewer's rows and asserted before the new data arrived.

**Result.** The step now waits until the id the lanes print names a read made by the new viewer, which only the new inspection shows; then it asserts. It passes, and fails when the selection is kept unconditionally or the filters are not reset.

**Consequence.** An e2e step after a viewer change waits on the new viewer's own lanes read.
