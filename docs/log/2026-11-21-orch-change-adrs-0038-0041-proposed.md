---
date: 2026-11-21
author: claude-orchestrator
type: change
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0038-tamper-evident-log-that-keeps-erasure.md
  - docs/decisions/0039-content-guards-at-the-write-gate.md
  - docs/decisions/0040-trust-floors.md
  - docs/decisions/0041-cedar-export-for-analysis.md
  - scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** Four ADRs are proposed, not accepted: 0038 (a hash chain over a content-free skeleton, so the log is tamper-evident and erasure still works), 0039 (content guards at the write gate), 0040 (trust floors), 0041 (Cedar export with a differential test).

**Why.** Cards E1.6, E2.8 to E2.11 and E2.12 of the absorb plan each make a choice another card could have made differently.

**Result.** Before: ADR 0034 was the only proposed ADR. After: 0034 and 0038 to 0041 are proposed, and `OWNER_DECIDES` in the tasks-and-decisions test names all five. Every new behaviour is off by default in each proposal.

**Consequence.** No card that depends on one starts before the lead answers items 49 to 52 of `docs/tasks/lead-decisions.md`.
