---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.18
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/properties.ts
supersedes: none
---

**What.** The first replay reported both control counterexamples as unfaithful decodes.

**Why.** The round-trip compare renamed the ids of the re-encoded Engram request through the solver's name map, so `person:s0` became a new scope name.

**Result.** The compare now keeps Engram's own ids on the re-encoded side; both control counterexamples then decode faithfully and are reproduced.

**Consequence.** Nothing further.
