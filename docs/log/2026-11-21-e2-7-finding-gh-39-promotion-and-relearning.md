---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.7
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
  - packages/core/test/counterexamples/trust.test.ts
  - packages/core/src/plane/promote.ts
  - packages/core/src/policy/evaluate.ts
  - packages/runner/src/config.ts
  - docs/log/2026-11-21-e2-7-finding-gh-39-surfaces.md
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-e2-7-finding-gh-39-floor-confirmed.md
---

**What.** GH-39 reaches promotion and the retired-content rule as well as the write gate: both judge the kind a sourceless caller claims.

**Why.** The superseded entry tested the write gate only.

**Result.** Under medium, two sourceless writers claiming `user` confirm the owner's episodic item: the promotion is allowed (`preset.medium/promotion/episodic-to-semantic`, "3 confirmations by distinct actors"), its item `user`; labelled `model`, denied (`engram/promote/no-evidence`), since `confirmationsOf` (`promote.ts:67`) reads the claimed kind. A sourceless write claiming `user` restates evicted content, allowed; labelled `model`, `engram/write/retired-content`. Adoption and grant changes still hold the floor. Surfaces: `2026-11-21-e2-7-finding-gh-39-surfaces.md`.

**Consequence.** No registered number moves: every benchmark writer sets a source, no H1 to H4 config promotes, and C5's agent is `model`. C6 and C7 are not built (`config.ts:15-16`); their cards must set sources, or GH-39 reaches a registered condition (backlog row).
