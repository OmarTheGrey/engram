---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - fixtures/profiles/twin-reads.json
  - packages/core/test/unit/plane/read.test.ts
supersedes: none
---

**What.** A first write refuses a grant carried twice, but may still carry an expired grant or one of another class; a grant change and a rewrite changing the grants run the whole of `grantDefect`.

**Why.** The review said to stop if refusing expired or duplicate grants on `Plane.write` broke fixtures: the twin profile's E9.2 fixture writes an expired grant expecting allow, so that case is kept. Refusing other-class grants on first writes failed six existing tests of other cards (read filter, read pipeline, promotion: a promotion's new class leaves its source's grant), so it is kept too. Duplicates broke nothing.

**Result.** Every existing test and fixture passes unchanged.

**Consequence.** ADR 0034, decision 6 and its open questions.
