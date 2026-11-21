---
date: 2026-11-21
author: claude-agent
type: decision
card: A5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/suite.ts
  - docs/research/absorb/01-stores.md
supersedes: none
---

**What.** The conformance suite refuses any adapter that claims `native_graph`, with the case "a claim of native graph is refused while the contract has no graph method".

**Why.** The contract has no method that returns a graph, and the absorb plan dropped `neighbors?` (AB-STO-1, MP-07), so a graph claim cannot be shown; passing it would leave an empty bar. No current adapter claims it, and Mem0 version 3 removed graph memory from its open-source package.

**Result.** Every registered adapter passes the case; the broken adapter "claims native graph" fails it.

**Consequence.** A future graph store (Graphiti, Zep) needs a contract amendment that names how a graph is shown before it can claim the flag. If the lead prefers the flag to stay claimable untested, this one case is removed.
