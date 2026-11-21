---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - fixtures/workspaces/inspector/provenance.json
  - packages/ui/test/workspace.ts
supersedes: none
---

**What.** The lineage fixture is a second workload beside the inspector's (`provenance.json`, same policy), and the long log is built at test time by `longLogWorkspace(20000)` through Plane.write.

**Why.** Adding steps to workload.json would move the E8.5 tests' counts; 20,000 writes through the client took too long.

**Result.** One write in a hundred is allowed; the rest are below the confidence floor and denied, which is what keeps it near 11 s. Dana sees 18,335 of the 20,000 events.

**Consequence.** If wrong, a log of mostly denied writes is not typical; the table's cost does not depend on the decision.
