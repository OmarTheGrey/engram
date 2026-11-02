---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/core/src/plane/retrieve.ts
supersedes: none
---

**What.** The round-3 mutation script restored each mutated file with `git checkout`, which also discarded the uncommitted C4 walk in `conditions.ts` and `retrieve.ts`.

**Why.** The work under test was not committed before mutating it.

**Result.** Both edits were applied again from their edit script and text, the tests and the C4 length script gave identical output, and the work was committed before the remaining mutations ran.

**Consequence.** Found while working the round-3 fix pass.
