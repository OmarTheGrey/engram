---
date: 2026-10-22
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: H4
evidence:
  - packages/core/src/adapter.ts
  - packages/adapters/test/conformance/suite.ts
supersedes: none
---

**What.** The Adapter contract now says `history` returns every distinct version under a ref, and the conformance suite checks that rewriting identical content adds no version.

**Why.** The final step-0 review found the fake skipped identical rewrites while the contract said every version written. A store that treats an identical rewrite as a no-op, as Mem0 does with NOOP, could not meet the stricter wording.

**Result.** The fake passes; a fake that records every write fails the new case.

**Consequence.** Real adapters are held to distinct versions only.
