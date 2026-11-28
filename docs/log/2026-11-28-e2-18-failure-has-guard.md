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
  - tools/symcc/src/main.rs
supersedes: none
---

**What.** The first domain did not compile: Cedar's typechecker refused `!(resource has ttl) || resource.ttl ...`.

**Why.** symcc compiles only well-typed policies, and the binary first reported only that the set was not well typed.

**Result.** Strict validation reads `has` as a guard in `&&` and in `if`, not in the right operand of `||`. The binary now prints every validation error, and the domain uses `if e has a then ... else true`. The export itself typed cleanly from the start.

**Consequence.** Nothing further.
