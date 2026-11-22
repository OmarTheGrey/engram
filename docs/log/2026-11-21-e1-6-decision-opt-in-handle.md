---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - packages/server/src/workspace.ts
supersedes: none
---

**What.** Only a handle registered with keepChain chains events; the CLI registers every handle it opens in process.

**Why.** Core draws no randomness, so salts must be injected, and appendEvent has a hundred callers that take only a Db. Chaining every handle would add statements to every append, which X15's committed query counts and the registered runs would see.

**Result.** A per-handle registry keeps research runs, tests and the perf budget byte-identical. A writer that does not keep the chain (the pi extension today) leaves its events unchained, and the verifier reports the first one as a broken anchor, never trusts it. Offboarding deletes salts on every handle, kept or not.

**Consequence.** If wrong, a later card moves salt injection into PlaneDeps; the format does not change.
