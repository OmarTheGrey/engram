---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/lint-model.test.ts
supersedes: none
---

**What.** Review finding L3-3: no test checked what the model is sent of a source reached only through a grant; a mutant accepting any source with grants passed all 936 core tests.

**Why.** The unit test's reach function was scope-only and no fixture held a grant. The code was correct.

**Result.** A Plane-level test now cites sources in person:sam behind a live grant, an expired grant, a grant for another class, a grant for another reader and none: only the live grant's source reaches a request, and the reviewer's mutant fails it.

**Consequence.** Reach through grants is held at the plane, where the lint's reach is built from readableAt.
