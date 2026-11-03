---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-03-pr4b-decision-store.md
---

**What.** Recommended, for the lead's decision: H1 runs on Mem0 (decision sheet item 2), with the fidelity cost now stated.

**Why.** the final verification of PR #27 (V-11): v1 did not say what "Mem0" is in the runner, and the sheet weighed time but not fidelity.

**Result.** It is Mem0's open-source library in process, with `infer: false`, a hashing embedder and a refusing model slot; no condition uses its search, so H1 exercises its storage and listing, not its model-driven extraction or semantic retrieval. v1's stopping rule now says so.

**Consequence.** If the lead wants Mem0's own retrieval exercised, that is a different condition design, not a store choice.
