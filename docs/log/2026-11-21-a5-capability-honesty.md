---
date: 2026-11-21
author: claude-agent
type: change
card: A5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/conformance/suite.ts
  - packages/adapters/test/conformance/validity.ts
  - packages/adapters/test/conformance/broken.ts
  - packages/adapters/test/conformance/meta.test.ts
  - "pnpm exec vitest run packages/adapters/test/conformance --no-file-parallelism"
supersedes: none
---

**What.** The conformance suite gains a group "capability honesty" (four cases held to a `native_validity` claim, one refusing a `native_graph` claim), a test double that wraps the fake and truthfully claims `native_validity`, registered as "fake with native validity", and seven broken adapters for the meta-test.

**Why.** ADR 0013's capability flags were claims nothing tested beyond "native search or history requires the method".

**Result.** The conformance folder passes: 280 tests passed, 34 skipped (cases for a capability or method an adapter lacks), 314 in all. Each broken adapter fails the cases it names; the double passes every case with none skipped. Making the double keep its first window fails the meta-test on the window case (mutation check). `packages/adapters/src/` is unchanged.

**Consequence.** A store that claims validity or graph now has a bar to pass.
