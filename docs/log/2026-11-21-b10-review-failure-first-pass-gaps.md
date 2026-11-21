---
date: 2026-11-21
author: claude-agent
type: failure
card: B10
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - packages/model/src/proxy.ts
  - packages/model/test/proxy.test.ts
supersedes: none
---

**What.** The first pass of card B10 shipped two gaps the review found: the endpoint check accepted any loopback port when called without the proxy, and the decision entry's claim that ENGRAM_OFFLINE is read on every call had no test.

**Why.** The first pass tested the endpoint check only against the running proxy, and tested the offline refusal only at start.

**Result.** A mutation reading the offline flag only at start passed all 17 tests of the first pass. Both are fixed and tested in the fix pass, and the mutation now fails the new test.

**Consequence.** Every claim in a decision entry gets a test that fails when the claim is broken.
