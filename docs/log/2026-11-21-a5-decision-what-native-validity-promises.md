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
  - packages/adapters/test/conformance/meta.test.ts
supersedes: none
---

**What.** `native_validity` promises four things the contract can observe: a rewrite that only closes or reopens the window is stored; nothing is hidden from list or search for being outside its window; no window field is derived from the store's bookkeeping; with history, each version keeps its own window. The cases run only on an adapter that claims the flag and are skipped, not passed, elsewhere.

**Why.** The card asks for "the behaviour the flag promises", and the absorb plan dropped the as-of argument, so only these are testable without a contract change. A skip shows that nothing ran.

**Result.** The meta-test now requires the honest fake to skip exactly those four cases and the validity double to run all of them.

**Consequence.** If wrong, a store that filters by validity natively, as Mem0 can, would be refused a claim the lead wants it to make.
