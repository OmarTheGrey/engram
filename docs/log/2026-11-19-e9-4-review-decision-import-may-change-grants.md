---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** On the write path, the owner may change an item's grants user-sourced or import-sourced; `Plane.changeGrants` stays user-only.

**Why.** Adoption writes the store's record as the store's owner with source `import`, and the review asked that adoption behave as before: a grant the person edits into their own file must still be adopted, not denied and retracted. An agent's direct edit of a store file is what the no-bypass hooks block (ADR 0014).

**Result.** A test adopts the owner's record with a grant edited in the store, and it lands (`packages/core/test/unit/plane/write-grants.test.ts`).

**Consequence.** If the lead wants grants never to arrive by adoption, the source check drops `import`, and adoption retracts such a record.
