---
date: 2026-11-21
author: claude-agent
type: decision
card: L5
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - docs/absorbed.md
supersedes: none
---

**What.** The tier uses 128 permutations in 32 bands of 4 rows and seed 0x4c35, not codebase-memory-mcp's 64 permutations in 32 bands of 2 rows.

**Why.** The card says to re-derive its parameters. Ours flag at 0.8 to 0.9; its 0.95 threshold is for code clones.

**Result.** With K = 128 the standard error is at most 0.044 and 0.032 at 0.85. The band curve 1 - (1 - J^4)^32 keeps 0.9998 of pairs at 0.7 and 0.05 at 0.2; theirs (midpoint 0.18) makes 95 percent of pairs at 0.3 candidates. Its header's "64 gives plus or minus 0.12 standard error" is about two standard errors at J = 0.5. Cost if wrong: more estimator noise near the threshold.

**Consequence.** The parameters are constants in near-duplicate.ts with tests.
