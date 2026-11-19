---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0013-adapter-contract-and-conformance.md
  - packages/adapters/src/mem0/index.ts
supersedes: none
---

**What.** ADR 0013 now says what a ref is after a delete (review finding RV-ADP-9): a ref names the store's record, and a rewrite of a deleted item id may land under a new ref.

**Why.** The reviewer's probe `mem0two.mts` showed that the Mem0 adapter gives a delete-then-rewrite of one item id a new ref (a new Mem0 memory id), while the files adapter reuses `<id>.md`; the contract said nothing either way.

**Result.** Docs only, as the card asked: the amendment states that the plane keeps the ref the latest write returned and that a ref from before the delete may read nothing; the Mem0 adapter's header says the same.

**Consequence.** Nothing changes in code; a future adapter knows it need not reuse a ref.
