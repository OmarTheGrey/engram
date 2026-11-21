---
date: 2026-11-21
author: claude-orchestrator
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0038-tamper-evident-log-that-keeps-erasure.md
  - docs/decisions/0039-content-guards-at-the-write-gate.md
  - docs/decisions/0040-trust-floors.md
  - docs/decisions/0041-cedar-export-for-analysis.md
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** ADRs 0038, 0039, 0040 and 0041 are accepted under the lead's delegation of 2026-11-21, each as its option (a), after the independent review's corrections to 0038, 0039 and 0040.

**Why.** The lead asked for the absorb plan's decisions to be closed with the best answer the project's record supports.

**Result.** 0038: the chain hashes each whole event with the erasable parts as salted commitments, and a redaction counts only when a chained manifest lists it. 0039: all three guards, off in registered presets, and a reason holds no character of a matched value. 0040: tests first, both floors opt-in, with the HTTP limit stated. 0041: export and differential test only.

**Consequence.** Cards E1.6, E2.8 to E2.12 are unblocked. The lead may overturn any. `OWNER_DECIDES` in the tasks-and-decisions test is back to ADR 0034 alone.
